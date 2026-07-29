/**
 * @file
 * @author Tomáš Chochola <tomaschochola@tomaschochola.cz>
 * @copyright © 2026 Tomáš Chochola <tomaschochola@tomaschochola.cz>
 *
 * @license CC-BY-ND-4.0
 *
 * @see {@link https://creativecommons.org/licenses/by-nd/4.0/} License
 * @see {@link https://github.com/tomaschochola} GitHub Profile
 * @see {@link https://github.com/sponsors/tomaschochola} GitHub Sponsors
 */

import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileBrowserEntries } from './webpack.js';

const browserArtifactRuntimeKey = '@tomaschochola/tooling-webpack/browser-artifacts';
const defaultScript = fileURLToPath(new URL('./default.ts', import.meta.url));
const defaultStylesheet = fileURLToPath(new URL('./default.scss', import.meta.url));
const defaultTemplate = fileURLToPath(new URL('./default.html', import.meta.url));
const maximumDimension = 16_384;
const maximumPixels = 100_000_000;
const maximumTimeout = 10 * 60 * 1000;

const pdfBooleanProperties = [
  'displayHeaderFooter',
  'landscape',
  'outline',
  'preferCSSPageSize',
  'printBackground',
  'tagged',
];

const pdfEndMarker = Buffer.from('%%EOF');

const pdfFormats = new Set([
  'A0',
  'A1',
  'A2',
  'A3',
  'A4',
  'A5',
  'A6',
  'Ledger',
  'Legal',
  'Letter',
  'Tabloid',
]);

const pdfSignature = Buffer.from('%PDF-');
const pdfStringProperties = ['footerTemplate', 'format', 'headerTemplate', 'pageRanges'];
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const browserArtifactDefaults = Object.freeze({
  entries: Object.freeze([defaultScript, defaultStylesheet]),
  script: defaultScript,
  stylesheet: defaultStylesheet,
  template: defaultTemplate,
});

function toPath(value, baseDirectory) {
  if (value instanceof URL) {
    if (value.protocol !== 'file:') {
      throw new TypeError(`Only file URLs are supported: ${value.href}`);
    }

    return fileURLToPath(value);
  }

  if (typeof value !== 'string' || value === '') {
    throw new TypeError(`Filesystem locations must be non-empty paths or file URLs: ${String(value)}`);
  }

  return resolve(baseDirectory, value);
}

function assertOwnedPath(rootDirectory, candidate, label) {
  const relativePath = relative(rootDirectory, candidate);

  if (relativePath === '' || relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error(`${label} must be a child of the project directory: ${candidate}`);
  }
}

function assertSeparatePaths(first, second, firstLabel, secondLabel) {
  const firstToSecond = relative(first, second);
  const secondToFirst = relative(second, first);
  const firstContainsSecond = firstToSecond === '' || (!firstToSecond.startsWith(`..${sep}`) && firstToSecond !== '..');
  const secondContainsFirst = secondToFirst === '' || (!secondToFirst.startsWith(`..${sep}`) && secondToFirst !== '..');

  if (firstContainsSecond || secondContainsFirst) {
    throw new Error(`${firstLabel} and ${secondLabel} must not overlap: ${first}, ${second}`);
  }
}

async function assertFile(filename, label) {
  const file = await stat(filename);

  if (!file.isFile()) {
    throw new TypeError(`${label} must be a file: ${filename}`);
  }
}

function normalizeEntries(entries, baseDirectory, label, allowEmpty = false) {
  if (!Array.isArray(entries) || (!allowEmpty && entries.length === 0)) {
    throw new TypeError(`${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array of filesystem locations.`);
  }

  return entries.map((entry) => toPath(entry, baseDirectory));
}

function validateTimeout(timeout) {
  if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > maximumTimeout) {
    throw new RangeError(`Timeout must be a positive integer no greater than ten minutes: ${String(timeout)}`);
  }
}

function validateOutput(output, extension) {
  const segments = output.split('/');

  if (
    output === ''
    || output.includes('\\')
    || !output.toLowerCase().endsWith(extension)
    || segments.some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new TypeError(`Browser artifact output must be a safe relative path ending in ${extension}: ${output}`);
  }
}

function validateSize(size) {
  if (
    size === null
    || typeof size !== 'object'
    || !Number.isSafeInteger(size.width)
    || !Number.isSafeInteger(size.height)
    || size.width <= 0
    || size.height <= 0
    || size.width > maximumDimension
    || size.height > maximumDimension
    || size.width * size.height > maximumPixels
  ) {
    throw new RangeError(`Browser artifact dimensions are invalid or exceed the safety limit: ${String(size)}`);
  }
}

function validatePdfDimension(value, label, allowZero = false) {
  const validNumber
    = typeof value === 'number' && Number.isFinite(value) && (allowZero ? value >= 0 : value > 0);

  const validString = typeof value === 'string' && value !== '' && value.length <= 100;

  if (!validNumber && !validString) {
    throw new TypeError(`${label} must be a ${allowZero ? 'non-negative' : 'positive'} number or a CSS dimension.`);
  }

  return value;
}

function validateOptionalBoolean(options, property) {
  const value = options[property];

  if (value !== undefined && typeof value !== 'boolean') {
    throw new TypeError(`PDF option "${property}" must be a boolean.`);
  }

  return value;
}

function validateOptionalString(options, property) {
  const value = options[property];

  if (value !== undefined && typeof value !== 'string') {
    throw new TypeError(`PDF option "${property}" must be a string.`);
  }

  return value;
}

function assignOptionalProperties(source, target, properties, validator) {
  for (const property of properties) {
    const value = validator(source, property);

    if (value !== undefined) {
      target[property] = value;
    }
  }
}

function validatePdfProperties(options) {
  const allowedProperties = new Set([
    'displayHeaderFooter',
    'footerTemplate',
    'format',
    'headerTemplate',
    'height',
    'landscape',
    'margin',
    'media',
    'outline',
    'pageRanges',
    'preferCSSPageSize',
    'printBackground',
    'scale',
    'tagged',
    'width',
  ]);

  for (const property of Object.keys(options)) {
    if (!allowedProperties.has(property)) {
      throw new TypeError(`Unknown PDF option: ${property}`);
    }
  }
}

function sanitizePdfFormat(format) {
  if (format !== undefined && !pdfFormats.has(format)) {
    throw new TypeError(`Unknown PDF format: ${format}`);
  }
}

function sanitizePdfScale(scale) {
  if (scale === undefined) {
    return undefined;
  }

  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale < 0.1 || scale > 2) {
    throw new RangeError('PDF option "scale" must be a number from 0.1 through 2.');
  }

  return scale;
}

function sanitizePdfMargin(input) {
  if (input === undefined) {
    return undefined;
  }

  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('PDF option "margin" must be an object.');
  }

  const margin = {};

  for (const property of Object.keys(input)) {
    if (!['bottom', 'left', 'right', 'top'].includes(property)) {
      throw new TypeError(`Unknown PDF margin: ${property}`);
    }

    margin[property] = validatePdfDimension(input[property], `PDF margin "${property}"`, true);
  }

  return margin;
}

function sanitizePdfMedia(media) {
  if (media !== undefined && media !== 'print' && media !== 'screen') {
    throw new TypeError('PDF option "media" must be either "print" or "screen".');
  }

  return media ?? 'print';
}

function sanitizePdfOptions(options, viewport) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('PDF options must be an object.');
  }

  validatePdfProperties(options);

  const sanitized = {
    height: `${String(viewport.height)}px`,
    outline: true,
    preferCSSPageSize: true,
    printBackground: true,
    tagged: true,
    width: `${String(viewport.width)}px`,
  };

  assignOptionalProperties(options, sanitized, pdfBooleanProperties, validateOptionalBoolean);
  assignOptionalProperties(options, sanitized, pdfStringProperties, validateOptionalString);
  assignOptionalProperties(options, sanitized, ['height', 'width'], (source, property) => {
    const value = source[property];

    return value === undefined
      ? undefined
      : validatePdfDimension(value, `PDF option "${property}"`);
  });

  sanitizePdfFormat(sanitized.format);

  const scale = sanitizePdfScale(options.scale);
  const margin = sanitizePdfMargin(options.margin);

  if (scale !== undefined) {
    sanitized.scale = scale;
  }

  if (margin !== undefined) {
    sanitized.margin = margin;
  }

  return {
    media: sanitizePdfMedia(options.media),
    options: sanitized,
  };
}

function sanitizePngOptions(options) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('PNG options must be an object.');
  }

  for (const property of Object.keys(options)) {
    if (property !== 'transparent') {
      throw new TypeError(`Unknown PNG option: ${property}`);
    }
  }

  if (options.transparent !== undefined && typeof options.transparent !== 'boolean') {
    throw new TypeError('PNG option "transparent" must be a boolean.');
  }

  return {
    transparent: options.transparent ?? false,
  };
}

function validateMetadata(metadata) {
  if (!Array.isArray(metadata) || metadata.length === 0) {
    throw new Error('The browser entry must define at least one artifact.');
  }

  const outputs = new Set();

  return metadata.map((artifact) => {
    if (
      artifact === null
      || typeof artifact !== 'object'
      || (artifact.type !== 'pdf' && artifact.type !== 'png')
    ) {
      throw new TypeError('The browser entry returned invalid artifact metadata.');
    }

    validateOutput(artifact.output, artifact.type === 'pdf' ? '.pdf' : '.png');
    validateSize(artifact.viewport);

    if (outputs.has(artifact.output)) {
      throw new Error(`Browser artifact output is defined more than once: ${artifact.output}`);
    }

    outputs.add(artifact.output);

    const validated = {
      output: artifact.output,
      type: artifact.type,
      viewport: {
        height: artifact.viewport.height,
        width: artifact.viewport.width,
      },
    };

    if (artifact.type === 'pdf') {
      const pdf = sanitizePdfOptions(artifact.options, validated.viewport);

      validated.media = pdf.media;
      validated.options = pdf.options;
    } else {
      validated.options = sanitizePngOptions(artifact.options);
    }

    return validated;
  });
}

function validatePng(buffer, size, output) {
  if (buffer.length < 24 || !buffer.subarray(0, pngSignature.length).equals(pngSignature)) {
    throw new Error(`Chromium returned an invalid PNG: ${output}`);
  }

  const actualWidth = buffer.readUInt32BE(16);
  const actualHeight = buffer.readUInt32BE(20);

  if (actualWidth !== size.width || actualHeight !== size.height) {
    throw new Error(
      `Chromium returned an unexpected PNG size for ${output}: ${String(actualWidth)}x${String(actualHeight)}, expected ${String(size.width)}x${String(size.height)}`,
    );
  }
}

function validatePdf(buffer, output) {
  if (
    buffer.length < 10
    || !buffer.subarray(0, pdfSignature.length).equals(pdfSignature)
    || !buffer.subarray(Math.max(0, buffer.length - 1024)).includes(pdfEndMarker)
  ) {
    throw new Error(`Chromium returned an invalid PDF: ${output}`);
  }
}

function collectPageErrors(page, errors, allowNetwork) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    errors.push(`page: ${error.stack ?? error.message}`);
  });
  page.on('requestfailed', (request) => {
    errors.push(`request: ${request.url()} (${request.failure()?.errorText ?? 'unknown failure'})`);
  });

  if (!allowNetwork) {
    return page.route(/^https?:\/\//u, async (route) => {
      errors.push(`network: blocked external request ${route.request().url()}`);
      await route.abort('blockedbyclient');
    });
  }

  return Promise.resolve();
}

async function openPage(browser, source, size, allowNetwork, timeout) {
  const context = await browser.newContext({
    acceptDownloads: false,
    deviceScaleFactor: 1,
    offline: !allowNetwork,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    viewport: size,
  });

  try {
    const page = await context.newPage();
    const errors = [];

    page.setDefaultNavigationTimeout(timeout);
    page.setDefaultTimeout(timeout);
    await collectPageErrors(page, errors, allowNetwork);
    await page.goto(pathToFileURL(source).href, {
      timeout,
      waitUntil: 'load',
    });

    return {
      context,
      errors,
      page,
    };
  } catch (error) {
    await context.close();

    throw error;
  }
}

function assertNoPageErrors(errors, output) {
  if (errors.length > 0) {
    throw new Error(`Browser artifact produced runtime errors for ${output}:\n${errors.join('\n')}`);
  }
}

async function collectBrokenImages(page) {
  return await page.evaluate(async () => {
    const collectImages = () => {
      const images = [];
      const roots = [globalThis.document];

      for (const root of roots) {
        for (const element of root.querySelectorAll('*')) {
          if (element instanceof globalThis.HTMLImageElement) {
            images.push(element);
          }

          if (element.shadowRoot !== null) {
            roots.push(element.shadowRoot);
          }
        }
      }

      return images;
    };

    await globalThis.document.fonts.ready;
    await Promise.all(
      collectImages().map(async (image) => {
        if (!image.complete) {
          await image.decode().catch(() => {
          });
        }
      }),
    );

    await new Promise((resolvePromise) => {
      globalThis.requestAnimationFrame(() => {
        globalThis.requestAnimationFrame(resolvePromise);
      });
    });

    return collectImages()
      .filter((image) => image.naturalWidth === 0 || image.naturalHeight === 0)
      .map((image) => image.currentSrc || image.src || '<missing src>');
  });
}

async function waitForReady(page, timeout) {
  let timeoutId;

  const timeoutPromise = new Promise((resolvePromise, rejectPromise) => {
    timeoutId = setTimeout(() => {
      rejectPromise(new Error(`Browser artifact resources did not become ready within ${String(timeout)} ms.`));
    }, timeout);
  });

  let brokenImages;

  try {
    brokenImages = await Promise.race([
      collectBrokenImages(page),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }

  if (brokenImages.length > 0) {
    throw new Error(`Browser artifact contains unloaded images:\n${brokenImages.join('\n')}`);
  }
}

async function readMetadata(page) {
  return await page.evaluate((runtimeKey) => {
    const runtime = Reflect.get(globalThis, Symbol.for(runtimeKey));

    if (runtime === null || typeof runtime !== 'object') {
      throw new Error(`Browser artifact runtime is unavailable: ${runtimeKey}`);
    }

    const list = Reflect.get(runtime, 'list');

    if (typeof list !== 'function') {
      throw new TypeError('Browser artifact runtime does not expose list().');
    }

    return Reflect.apply(list, runtime, []);
  }, browserArtifactRuntimeKey);
}

async function renderArtifact(page, index) {
  await page.evaluate(
    async ({ artifactIndex, runtimeKey }) => {
      const runtime = Reflect.get(globalThis, Symbol.for(runtimeKey));

      if (runtime === null || typeof runtime !== 'object') {
        throw new Error(`Browser artifact runtime is unavailable: ${runtimeKey}`);
      }

      const render = Reflect.get(runtime, 'render');

      if (typeof render !== 'function') {
        throw new TypeError('Browser artifact runtime does not expose render().');
      }

      await Reflect.apply(render, runtime, [artifactIndex]);
    },
    {
      artifactIndex: index,
      runtimeKey: browserArtifactRuntimeKey,
    },
  );
}

async function publishDirectory(sourceDirectory, outputDirectory, rootDirectory) {
  const outputParent = dirname(outputDirectory);

  await mkdir(outputParent, { recursive: true });

  const publishRoot = await mkdtemp(join(outputParent, '.browser-artifacts-publish-'));
  const publishDirectory = join(publishRoot, 'output');
  const backupDirectory = join(dirname(outputDirectory), `.${basename(outputDirectory)}.backup-${randomUUID()}`);

  let backupCreated = false;

  assertOwnedPath(rootDirectory, publishRoot, 'Browser artifact publish directory');
  assertOwnedPath(rootDirectory, backupDirectory, 'Browser artifact backup directory');

  try {
    await cp(sourceDirectory, publishDirectory, {
      errorOnExist: true,
      force: false,
      recursive: true,
    });

    try {
      await rename(outputDirectory, backupDirectory);
      backupCreated = true;
    } catch (error) {
      if (error === null || typeof error !== 'object' || error.code !== 'ENOENT') {
        throw error;
      }
    }

    try {
      await rename(publishDirectory, outputDirectory);
    } catch (publishError) {
      if (backupCreated) {
        try {
          await rename(backupDirectory, outputDirectory);
        } catch (restoreError) {
          throw new AggregateError(
            [publishError, restoreError],
            `Unable to publish browser artifacts or restore the previous output. Recovery copy: ${backupDirectory}`,
          );
        }
      }

      throw publishError;
    }

    if (backupCreated) {
      await rm(backupDirectory, {
        force: true,
        recursive: true,
      });
    }
  } finally {
    await rm(publishRoot, {
      force: true,
      recursive: true,
    });
  }
}

export async function generateBrowserArtifacts({
  allowNetwork = false,
  entries,
  outputDirectory,
  projectDirectory = process.cwd(),
  template = defaultTemplate,
  temporaryDirectory = tmpdir(),
  timeout = 60_000,
}) {
  const projectPath = toPath(projectDirectory, process.cwd());
  const entryPaths = normalizeEntries(entries, projectPath, 'Browser artifact entries');
  const outputPath = toPath(outputDirectory, projectPath);
  const templatePath = toPath(template, projectPath);
  const temporaryPath = toPath(temporaryDirectory, projectPath);

  if (typeof allowNetwork !== 'boolean') {
    throw new TypeError(`allowNetwork must be a boolean: ${String(allowNetwork)}`);
  }

  validateTimeout(timeout);
  assertOwnedPath(projectPath, outputPath, 'Browser artifact output directory');
  await assertFile(templatePath, 'Browser artifact template');
  await Promise.all(entryPaths.map(async (entry) => await assertFile(entry, 'Browser artifact entry')));

  await mkdir(temporaryPath, { recursive: true });

  const workPath = await mkdtemp(join(temporaryPath, 'tooling-browser-artifacts-'));
  const buildPath = join(workPath, 'build');
  const stagePath = join(workPath, 'stage');

  let browser;

  try {
    assertSeparatePaths(outputPath, workPath, 'Browser artifact output directory', 'browser artifact work directory');
    await mkdir(stagePath, { recursive: true });

    await compileBrowserEntries({
      entries: entryPaths,
      outputDirectory: buildPath,
      projectDirectory: projectPath,
      template: templatePath,
    });

    const source = join(buildPath, 'index.html');

    await assertFile(source, 'Compiled browser artifact page');
    const { chromium } = await import('playwright');

    browser = await chromium.launch();

    const discovery = await openPage(browser, source, {
      height: 1,
      width: 1,
    }, allowNetwork, timeout);

    let metadata;

    try {
      metadata = validateMetadata(await readMetadata(discovery.page));
      assertNoPageErrors(discovery.errors, 'artifact definitions');
    } finally {
      await discovery.context.close();
    }

    for (const [index, artifact] of metadata.entries()) {
      const rendering = await openPage(browser, source, artifact.viewport, allowNetwork, timeout);

      try {
        if (artifact.type === 'pdf') {
          await rendering.page.emulateMedia({
            media: artifact.media,
          });
        }

        await renderArtifact(rendering.page, index);
        await waitForReady(rendering.page, timeout);
        assertNoPageErrors(rendering.errors, artifact.output);

        let buffer;

        if (artifact.type === 'pdf') {
          buffer = await rendering.page.pdf(artifact.options);
          validatePdf(buffer, artifact.output);
        } else {
          buffer = await rendering.page.screenshot({
            animations: 'disabled',
            caret: 'hide',
            fullPage: false,
            omitBackground: artifact.options.transparent,
            scale: 'css',
            type: 'png',
          });
          validatePng(buffer, artifact.viewport, artifact.output);
        }

        const target = join(stagePath, ...artifact.output.split('/'));

        assertOwnedPath(stagePath, target, 'Browser artifact file');
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, buffer, { flag: 'wx' });
      } finally {
        await rendering.context.close();
      }
    }

    await publishDirectory(stagePath, outputPath, projectPath);
  } finally {
    await browser?.close();
    await rm(workPath, {
      force: true,
      recursive: true,
    });
  }
}
