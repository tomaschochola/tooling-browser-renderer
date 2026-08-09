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
import { mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileBrowserPage } from './webpack.js';

const defaultTemplate = fileURLToPath(new URL('./index.html', import.meta.url));
const pdfEndMarker = Buffer.from('%%EOF');
const pdfSignature = Buffer.from('%PDF-');
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function toPath(value, baseDirectory) {
  if (typeof value !== 'string' || value === '') {
    throw new TypeError(`Filesystem locations must be non-empty paths: ${String(value)}`);
  }

  return resolve(baseDirectory, value);
}

async function readMetadata(location, label) {
  try {
    return await stat(location);
  } catch (error) {
    throw new Error(`${label} cannot be accessed: ${location}`, {
      cause: error,
    });
  }
}

async function assertFile(filename, label) {
  const metadata = await readMetadata(filename, label);

  if (!metadata.isFile()) {
    throw new TypeError(`${label} must be a file: ${filename}`);
  }
}

function assertOutputExtension(output, type) {
  const extension = type === 'png' ? '.png' : '.pdf';

  if (!output.toLowerCase().endsWith(extension)) {
    throw new TypeError(`${type.toUpperCase()} output must end in ${extension}: ${output}`);
  }
}

function isRemoteLocation(value) {
  return /^https?:\/\//iu.test(value);
}

async function resolveAsset(name, location, projectDirectory) {
  if (isRemoteLocation(location) || /^data:/iu.test(location)) {
    return {
      name,
      source: location,
      type: 'literal',
    };
  }

  const filename = toPath(location, projectDirectory);

  await assertFile(filename, 'Browser artifact asset');

  return {
    name,
    source: filename,
    type: 'module',
  };
}

async function resolveAssets(assets, projectDirectory) {
  const resolvedAssets = [];

  for (const [name, location] of Object.entries(assets)) {
    resolvedAssets.push(await resolveAsset(name, location, projectDirectory));
  }

  return resolvedAssets;
}

function createBrowserArtifactBootstrap(assets, data) {
  const imports = [];
  const assetProperties = [];
  let moduleIndex = 0;

  for (const asset of assets) {
    if (asset.type === 'module') {
      const binding = `asset${String(moduleIndex)}`;
      const request = `${asset.source}?resource`;

      imports.push(`import ${binding} from ${JSON.stringify(request)};`);
      assetProperties.push(`    ${JSON.stringify(asset.name)}: ${binding},`);
      moduleIndex += 1;
    } else {
      assetProperties.push(`    ${JSON.stringify(asset.name)}: ${JSON.stringify(asset.source)},`);
    }
  }

  const dataProperties = Object.entries(data).map(([name, value]) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)},`);

  return `${imports.join('\n')}${imports.length > 0 ? '\n\n' : ''}globalThis.browserArtifact = {
  assets: {
${assetProperties.join('\n')}
  },
  data: {
${dataProperties.join('\n')}
  },
};
`;
}

function collectPageFailures(page, failures) {
  page.on('crash', () => {
    failures.push('page: Chromium page crashed');
  });
  page.on('pageerror', (error) => {
    failures.push(`page: ${error.stack ?? error.message}`);
  });
  page.on('requestfailed', (request) => {
    failures.push(`request: ${request.url()} (${request.failure()?.errorText ?? 'unknown failure'})`);
  });
}

async function configureNetworkAccess(page, allowNetwork) {
  if (allowNetwork) {
    return;
  }

  await page.route(/^https?:\/\//iu, async (route) => {
    await route.abort('blockedbyclient');
  });
}

export async function inspectBrowserResources() {
  await globalThis.browserArtifact?.ready;

  const collectImages = () => {
    const images = [];
    const roots = [globalThis.document];

    for (let index = 0; index < roots.length; index += 1) {
      const root = roots[index];

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

  const images = collectImages();

  await globalThis.document.fonts.ready;
  await Promise.allSettled(images.map((image) => image.decode()));
  await new Promise((resolvePromise) => {
    globalThis.requestAnimationFrame(() => {
      globalThis.requestAnimationFrame(resolvePromise);
    });
  });

  return collectImages()
    .filter((image) => image.naturalWidth === 0 || image.naturalHeight === 0)
    .map((image) => image.currentSrc || image.src || '<missing src>');
}

async function inspectResources(page) {
  return await page.evaluate(inspectBrowserResources);
}

async function waitForResources(page, timeout) {
  let timeoutId;

  const timeoutPromise = new Promise((resolvePromise, rejectPromise) => {
    timeoutId = setTimeout(() => {
      rejectPromise(new Error(`Browser artifact resources did not become ready within ${String(timeout)} ms.`));
    }, timeout);
  });

  let brokenImages;

  try {
    brokenImages = await Promise.race([inspectResources(page), timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }

  if (brokenImages.length > 0) {
    throw new Error(`Browser artifact contains unloaded images:\n${brokenImages.join('\n')}`);
  }
}

function assertNoPageFailures(failures) {
  if (failures.length > 0) {
    throw new Error(`Browser artifact page failed:\n${failures.join('\n')}`);
  }
}

function validatePng(buffer, options) {
  if (buffer.length < 24 || !buffer.subarray(0, pngSignature.length).equals(pngSignature)) {
    throw new Error('Chromium returned an invalid PNG.');
  }

  const actualWidth = buffer.readUInt32BE(16);
  const actualHeight = buffer.readUInt32BE(20);
  const expectedWidth = options.viewport.width * options.pixelRatio;
  const expectedHeight = options.viewport.height * options.pixelRatio;

  if (actualWidth !== expectedWidth || actualHeight !== expectedHeight) {
    throw new Error(`Chromium returned an unexpected PNG size: ${String(actualWidth)}x${String(actualHeight)}, expected ${String(expectedWidth)}x${String(expectedHeight)}.`);
  }
}

function validatePdf(buffer) {
  const tail = buffer.subarray(Math.max(0, buffer.length - 1024));

  if (buffer.length < 10 || !buffer.subarray(0, pdfSignature.length).equals(pdfSignature) || !tail.includes(pdfEndMarker)) {
    throw new Error('Chromium returned an invalid PDF.');
  }
}

function createPdfOptions(options) {
  const pdf = {
    outline: true,
    printBackground: true,
    tagged: true,
  };

  if (options.paper.type === 'format') {
    pdf.format = options.paper.format;
    pdf.landscape = options.landscape;

    if (options.margin !== undefined) {
      pdf.margin = options.margin;
    }
  } else {
    pdf.preferCSSPageSize = true;
  }

  return pdf;
}

async function capturePage(page, options) {
  if (options.type === 'png') {
    const buffer = await page.screenshot({
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
      omitBackground: options.transparent,
      scale: 'device',
      type: 'png',
    });

    validatePng(buffer, options);

    return buffer;
  }

  const buffer = await page.pdf(createPdfOptions(options));

  validatePdf(buffer);

  return buffer;
}

async function renderPage(browser, source, options) {
  const contextOptions = {
    acceptDownloads: false,
    offline: !options.allowNetwork,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  };

  if (options.type === 'png') {
    contextOptions.deviceScaleFactor = options.pixelRatio;
    contextOptions.viewport = options.viewport;
  }

  const context = await browser.newContext(contextOptions);

  try {
    const page = await context.newPage();
    const failures = [];

    page.setDefaultNavigationTimeout(options.timeout);
    page.setDefaultTimeout(options.timeout);

    if (options.type === 'pdf') {
      await page.emulateMedia({
        media: 'print',
      });
    }

    collectPageFailures(page, failures);
    await configureNetworkAccess(page, options.allowNetwork);
    await page.goto(pathToFileURL(source).href, {
      timeout: options.timeout,
      waitUntil: 'load',
    });
    await page.waitForLoadState('networkidle', {
      timeout: options.timeout,
    });

    if (options.waitForSelector !== undefined) {
      await page.locator(options.waitForSelector).waitFor({
        state: 'attached',
      });
    }

    await waitForResources(page, options.timeout);
    assertNoPageFailures(failures);

    const buffer = await capturePage(page, options);

    assertNoPageFailures(failures);

    return buffer;
  } finally {
    await context.close();
  }
}

async function publishFile(buffer, output) {
  const parent = dirname(output);
  const temporary = join(parent, `.${basename(output)}.temporary-${randomUUID()}`);

  await mkdir(parent, { recursive: true });

  try {
    await writeFile(temporary, buffer, {
      flag: 'wx',
    });
    await rename(temporary, output);
  } finally {
    await rm(temporary, {
      force: true,
    });
  }
}

async function loadPlaywright() {
  return await import('playwright');
}

export async function generateBrowserArtifact(options, dependencies = {}) {
  const compile = dependencies.compile ?? compileBrowserPage;
  const loadBrowser = dependencies.loadPlaywright ?? loadPlaywright;
  const projectDirectory = process.cwd();
  const output = toPath(options.output, projectDirectory);
  const entries = [...options.entries];
  const data = options.data ?? {};

  assertOutputExtension(output, options.type);
  const assets = await resolveAssets(options.assets ?? {}, projectDirectory);

  const workDirectory = await mkdtemp(join(tmpdir(), 'tooling-browser-artifacts-'));
  const buildDirectory = join(workDirectory, 'build');

  let browser;

  try {
    if (assets.length > 0 || Object.keys(data).length > 0) {
      const browserArtifactBootstrap = join(workDirectory, 'browser-artifact.js');

      await writeFile(browserArtifactBootstrap, createBrowserArtifactBootstrap(assets, data), {
        flag: 'wx',
      });
      entries.unshift(browserArtifactBootstrap);
    }

    await compile({
      entries,
      outputDirectory: buildDirectory,
      projectDirectory,
      template: defaultTemplate,
    });

    const source = join(buildDirectory, 'index.html');

    await assertFile(source, 'Compiled HTML page');

    const { chromium } = await loadBrowser();

    browser = await chromium.launch();

    const buffer = await renderPage(browser, source, options);

    await publishFile(buffer, output);
  } finally {
    await browser?.close();

    await rm(workDirectory, {
      force: true,
      recursive: true,
    });
  }
}
