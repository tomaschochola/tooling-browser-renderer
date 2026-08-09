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

import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { generateBrowserArtifact, inspectBrowserResources } from '../src/generate.js';

function createPng(width, height) {
  const buffer = Buffer.alloc(24);

  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);

  return buffer;
}

function createPdf() {
  return Buffer.from('%PDF-1.7\ncontent\n%%EOF');
}

function createBrowser(configuration = {}) {
  const events = new Map();
  const observations = {
    browserClosed: false,
    contextClosed: false,
    pageActions: [],
    routes: 0,
  };

  const page = {
    async emulateMedia(options) {
      observations.media = options;
      observations.pageActions.push('emulateMedia');
    },
    async evaluate() {
      if (configuration.resourcesNeverResolve) {
        return await new Promise(() => {});
      }

      return configuration.brokenImages ?? [];
    },
    async goto(url, options) {
      observations.navigation = { options, url };
      observations.pageActions.push('goto');

      for (const event of configuration.events ?? []) {
        if (event === 'crash') {
          events.get('crash')?.();
        } else if (event === 'pageerror') {
          events.get('pageerror')?.(configuration.pageFailure ?? new Error('page failed'));
        } else {
          events.get('requestfailed')?.({
            failure: () => (Object.hasOwn(configuration, 'requestFailure') ? configuration.requestFailure : { errorText: 'request failed' }),
            url: () => 'https://example.invalid/resource',
          });
        }
      }
    },
    locator(selector) {
      observations.selector = selector;

      return {
        async waitFor(options) {
          observations.selectorOptions = options;
        },
      };
    },
    on(event, listener) {
      events.set(event, listener);
    },
    async pdf(options) {
      observations.pdf = options;

      if (configuration.captureEvent !== undefined) {
        events.get(configuration.captureEvent)?.(new Error('capture failed'));
      }

      return configuration.pdf ?? createPdf();
    },
    async route(pattern, listener) {
      observations.routePattern = pattern;
      observations.routes += 1;
      observations.routeListener = listener;
    },
    async screenshot(options) {
      observations.screenshot = options;

      if (configuration.captureEvent !== undefined) {
        events.get(configuration.captureEvent)?.(new Error('capture failed'));
      }

      return configuration.png ?? createPng(128, 64);
    },
    setDefaultNavigationTimeout(timeout) {
      observations.navigationTimeout = timeout;
    },
    setDefaultTimeout(timeout) {
      observations.timeout = timeout;
    },
    async waitForLoadState(state, options) {
      observations.loadState = { options, state };
      observations.pageActions.push('waitForLoadState');
    },
  };

  const context = {
    async close() {
      observations.contextClosed = true;
    },
    async newPage() {
      if (configuration.pageError !== undefined) {
        throw configuration.pageError;
      }

      return page;
    },
  };

  const browser = {
    async close() {
      observations.browserClosed = true;
    },
    async newContext(options) {
      observations.context = options;

      return context;
    },
  };

  return {
    loadPlaywright: async () => ({
      chromium: {
        async launch() {
          if (configuration.launchError !== undefined) {
            throw configuration.launchError;
          }

          return browser;
        },
      },
    }),
    observations,
  };
}

async function createProject() {
  const directory = await mkdtemp(join(tmpdir(), 'tooling-browser-renderer-test-'));
  const entry = join(directory, 'artifact.js');

  await writeFile(entry, 'document.body.textContent = "artifact";\n');

  return {
    directory,
    entry,
  };
}

async function compilePage(observations, options) {
  observations.compile = options;
  observations.entryContents = await Promise.all(options.entries.map(async (entry) => await readFile(entry, 'utf8')));
  await mkdir(options.outputDirectory, { recursive: true });
  await writeFile(join(options.outputDirectory, 'index.html'), '<!doctype html><html><body></body></html>');
}

function pngOptions(project) {
  return {
    allowNetwork: false,
    entries: [project.entry],
    output: join(project.directory, 'generated/card.png'),
    pixelRatio: 2,
    timeout: 1000,
    transparent: true,
    type: 'png',
    viewport: {
      height: 32,
      width: 64,
    },
    waitForSelector: '[data-ready]',
  };
}

function pdfOptions(project, paper) {
  return {
    allowNetwork: true,
    entries: [project.entry],
    landscape: false,
    margin: {
      bottom: '4mm',
      left: '3mm',
      right: '2mm',
      top: '1mm',
    },
    output: join(project.directory, 'generated/document.pdf'),
    paper,
    timeout: 1000,
    type: 'pdf',
  };
}

test('builds and atomically publishes an exact PNG without deleting siblings', async () => {
  const project = await createProject();
  const browser = createBrowser();
  const observations = browser.observations;
  const sibling = join(project.directory, 'generated/sibling.txt');
  const output = join(project.directory, 'generated/card.png');

  try {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, 'old');
    await writeFile(sibling, 'keep');

    await generateBrowserArtifact(pngOptions(project), {
      compile: async (options) => await compilePage(observations, options),
      loadPlaywright: browser.loadPlaywright,
    });

    assert.deepEqual(await readFile(output), createPng(128, 64));
    assert.equal(await readFile(sibling, 'utf8'), 'keep');
    assert.deepEqual(observations.compile.entries, [project.entry]);
    assert.equal(observations.compile.projectDirectory, process.cwd());
    assert.equal(observations.context.deviceScaleFactor, 2);
    assert.equal(observations.context.offline, true);
    assert.equal(observations.routes, 1);
    assert.equal(observations.selector, '[data-ready]');
    assert.deepEqual(observations.selectorOptions, { state: 'attached' });
    assert.equal(observations.navigationTimeout, 1000);
    assert.equal(observations.timeout, 1000);
    assert.deepEqual(observations.loadState, {
      options: {
        timeout: 1000,
      },
      state: 'networkidle',
    });
    assert.deepEqual(observations.screenshot, {
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
      omitBackground: true,
      scale: 'device',
      type: 'png',
    });
    assert.equal(observations.contextClosed, true);
    assert.equal(observations.browserClosed, true);
    let abortReason;

    await observations.routeListener({
      async abort(reason) {
        abortReason = reason;
      },
    });
    assert.equal(abortReason, 'blockedbyclient');
  } finally {
    await rm(project.directory, { force: true, recursive: true });
  }
});

test('routes assets and plain-text data through a generated Webpack bootstrap', async () => {
  const project = await createProject();
  const externalDirectory = await mkdtemp(join(tmpdir(), 'tooling-browser-renderer-external-test-'));
  const browser = createBrowser();
  const observations = browser.observations;
  const asset = join(externalDirectory, 'logo.svg');
  const assetRequest = `${asset}?resource`;
  let assetBootstrap;

  try {
    await writeFile(asset, '<svg xmlns="http://www.w3.org/2000/svg"/>\n');

    const options = {
      ...pngOptions(project),
      allowNetwork: true,
      assets: {
        background: 'https://example.com/background.png',
        icon: 'data:image/svg+xml,%3Csvg/%3E',
        image: asset,
      },
      data: {
        message: 'quotes: " and newlines:\nare inert',
      },
      output: join(externalDirectory, 'card.png'),
    };

    await generateBrowserArtifact(options, {
      compile: async (compileOptions) => {
        assetBootstrap = compileOptions.entries[0];
        await compilePage(observations, compileOptions);
      },
      loadPlaywright: browser.loadPlaywright,
    });

    assert.deepEqual(observations.compile.entries, [assetBootstrap, project.entry]);
    assert.equal(
      observations.entryContents[0],
      `import asset0 from ${JSON.stringify(assetRequest)};

globalThis.browserArtifact = {
  assets: {
    "background": "https://example.com/background.png",
    "icon": "data:image/svg+xml,%3Csvg/%3E",
    "image": asset0,
  },
  data: {
    "message": ${JSON.stringify('quotes: " and newlines:\nare inert')},
  },
};
`,
    );
    assert.equal(observations.context.offline, false);
    assert.deepEqual(await readFile(options.output), createPng(128, 64));
    await assert.rejects(async () => await stat(assetBootstrap));
  } finally {
    await rm(project.directory, { force: true, recursive: true });
    await rm(externalDirectory, { force: true, recursive: true });
  }
});

test('creates an import-free bootstrap for literal assets and data-only inputs', async () => {
  const project = await createProject();
  const browser = createBrowser();
  let bootstrap;

  try {
    await generateBrowserArtifact(
      {
        ...pngOptions(project),
        assets: {
          image: 'https://example.com/logo.svg',
        },
        data: {
          title: 'Artifact',
        },
      },
      {
        compile: async (options) => {
          bootstrap = options.entries[0];

          await compilePage(browser.observations, options);
        },
        loadPlaywright: browser.loadPlaywright,
      },
    );

    assert.equal(
      browser.observations.entryContents[0],
      `globalThis.browserArtifact = {
  assets: {
    "image": "https://example.com/logo.svg",
  },
  data: {
    "title": "Artifact",
  },
};
`,
    );
    await assert.rejects(async () => await stat(bootstrap));

    const dataOnlyBrowser = createBrowser();

    await generateBrowserArtifact(
      {
        ...pngOptions(project),
        data: {
          title: 'Data only',
        },
      },
      {
        compile: async (options) => await compilePage(dataOnlyBrowser.observations, options),
        loadPlaywright: dataOnlyBrowser.loadPlaywright,
      },
    );

    assert.match(dataOnlyBrowser.observations.entryContents[0], /"title": "Data only"/u);
  } finally {
    await rm(project.directory, { force: true, recursive: true });
  }
});

test('waits for fonts, images, shadow roots, and rendering frames', async () => {
  const originalBrowserArtifact = globalThis.browserArtifact;
  const originalDocument = globalThis.document;
  const originalImage = globalThis.HTMLImageElement;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const frames = [];

  class ImageElement {
    constructor({ currentSrc = '', decodeError, naturalHeight, naturalWidth, src = '' }) {
      this.currentSrc = currentSrc;
      this.decodeError = decodeError;
      this.naturalHeight = naturalHeight;
      this.naturalWidth = naturalWidth;
      this.src = src;
      this.shadowRoot = null;
    }

    async decode() {
      if (this.decodeError) {
        throw new Error('decode failed');
      }
    }
  }

  const valid = new ImageElement({
    currentSrc: 'valid.png',
    naturalHeight: 10,
    naturalWidth: 10,
  });
  const broken = new ImageElement({
    decodeError: true,
    naturalHeight: 0,
    naturalWidth: 0,
  });
  const brokenCurrentSource = new ImageElement({
    currentSrc: 'current.png',
    naturalHeight: 10,
    naturalWidth: 0,
  });
  const brokenSource = new ImageElement({
    naturalHeight: 0,
    naturalWidth: 10,
    src: 'source.png',
  });
  const dynamic = new ImageElement({
    naturalHeight: 0,
    naturalWidth: 0,
    src: 'dynamic.png',
  });
  const shadowRoot = {
    querySelectorAll() {
      return [broken, brokenCurrentSource, brokenSource];
    },
  };
  const host = {
    shadowRoot,
  };
  let documentQueries = 0;
  let productReady = false;

  try {
    globalThis.browserArtifact = {
      ready: Promise.resolve().then(() => {
        productReady = true;
      }),
    };
    globalThis.HTMLImageElement = ImageElement;
    globalThis.document = {
      get fonts() {
        assert.equal(productReady, true);

        return {
          ready: Promise.resolve(),
        };
      },
      querySelectorAll() {
        documentQueries += 1;

        return documentQueries === 1 ? [valid, host] : [valid, host, dynamic];
      },
    };
    globalThis.requestAnimationFrame = (callback) => {
      frames.push(callback);
      callback();
    };

    assert.deepEqual(await inspectBrowserResources(), ['dynamic.png', '<missing src>', 'current.png', 'source.png']);
    assert.equal(frames.length, 2);
  } finally {
    globalThis.browserArtifact = originalBrowserArtifact;
    globalThis.document = originalDocument;
    globalThis.HTMLImageElement = originalImage;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  }
});

test('builds PDF artifacts for format-owned and CSS-owned paper geometry', async () => {
  const project = await createProject();
  const papers = [
    {
      expected: {
        format: 'A4',
        landscape: false,
        margin: {
          bottom: '4mm',
          left: '3mm',
          right: '2mm',
          top: '1mm',
        },
      },
      paper: { format: 'A4', type: 'format' },
    },
    {
      expected: { preferCSSPageSize: true },
      paper: { type: 'css' },
    },
  ];

  try {
    for (const [index, fixture] of papers.entries()) {
      const browser = createBrowser();
      const observations = browser.observations;
      const options = pdfOptions(project, fixture.paper);

      options.output = join(project.directory, `generated/document-${String(index)}.pdf`);

      if (fixture.paper.type === 'css') {
        delete options.landscape;
        delete options.margin;
      }

      await generateBrowserArtifact(options, {
        compile: async (compileOptions) => await compilePage(observations, compileOptions),
        loadPlaywright: browser.loadPlaywright,
      });

      assert.deepEqual(observations.compile.entries, [project.entry]);
      assert.deepEqual(observations.entryContents, ['document.body.textContent = "artifact";\n']);
      assert.equal(observations.routes, 0);
      assert.deepEqual(observations.media, { media: 'print' });
      assert.deepEqual(observations.pageActions, ['emulateMedia', 'goto', 'waitForLoadState']);
      assert.deepEqual(observations.context, {
        acceptDownloads: false,
        offline: false,
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
      });
      assert.deepEqual(observations.pdf, {
        outline: true,
        printBackground: true,
        tagged: true,
        ...fixture.expected,
      });
      assert.deepEqual(await readFile(options.output), createPdf());
    }
  } finally {
    await rm(project.directory, { force: true, recursive: true });
  }
});

test('reports browser failures and always closes browser resources', async () => {
  const project = await createProject();

  try {
    const fixtures = [
      {
        configuration: { brokenImages: ['file:///broken.png'] },
        expectation: /contains unloaded images:\nfile:\/\/\/broken\.png/u,
      },
      {
        configuration: { events: ['crash', 'pageerror', 'requestfailed'] },
        expectation: /page crashed.*page failed.*request failed/su,
      },
      {
        configuration: {
          events: ['pageerror', 'requestfailed'],
          pageFailure: { message: 'page failed without a stack', stack: undefined },
          requestFailure: null,
        },
        expectation: /page failed without a stack.*unknown failure/su,
      },
      {
        configuration: { pageError: new Error('page creation failed') },
        expectation: /page creation failed/u,
      },
      {
        configuration: { captureEvent: 'pageerror' },
        expectation: /capture failed/u,
      },
      {
        configuration: { png: Buffer.from('invalid') },
        expectation: /invalid PNG/u,
      },
      {
        configuration: { png: Buffer.alloc(24) },
        expectation: /invalid PNG/u,
      },
      {
        configuration: { png: createPng(1, 1) },
        expectation: /unexpected PNG size/u,
      },
    ];

    for (const { configuration, expectation } of fixtures) {
      const browser = createBrowser(configuration);

      await assert.rejects(
        async () =>
          await generateBrowserArtifact(pngOptions(project), {
            compile: async (options) => await compilePage(browser.observations, options),
            loadPlaywright: browser.loadPlaywright,
          }),
        expectation,
      );

      assert.equal(browser.observations.browserClosed, true);

      if (configuration.pageError === undefined) {
        assert.equal(browser.observations.contextClosed, true);
      }
    }

    const timeoutBrowser = createBrowser({ resourcesNeverResolve: true });
    const timeoutOptions = pngOptions(project);

    timeoutOptions.timeout = 1;

    await assert.rejects(
      async () =>
        await generateBrowserArtifact(timeoutOptions, {
          compile: async (options) => await compilePage(timeoutBrowser.observations, options),
          loadPlaywright: timeoutBrowser.loadPlaywright,
        }),
      /did not become ready/u,
    );
  } finally {
    await rm(project.directory, { force: true, recursive: true });
  }
});

test('rejects invalid PDF output from Chromium', async () => {
  const project = await createProject();

  try {
    for (const pdf of [Buffer.from('invalid'), Buffer.from('not-a-pdf-document%%EOF'), Buffer.from('%PDF-1.7\nwithout an end marker')]) {
      const browser = createBrowser({ pdf });

      await assert.rejects(
        async () =>
          await generateBrowserArtifact(pdfOptions(project, { format: 'A4', type: 'format' }), {
            compile: async (options) => await compilePage(browser.observations, options),
            loadPlaywright: browser.loadPlaywright,
          }),
        /invalid PDF/u,
      );
    }
  } finally {
    await rm(project.directory, { force: true, recursive: true });
  }
});

test('validates filesystem inputs before launching Chromium', async () => {
  const project = await createProject();
  const directoryAsset = join(project.directory, 'asset-directory');
  const browser = createBrowser();
  let compiled = false;

  try {
    await mkdir(directoryAsset);

    const fixtures = [
      [{ ...pngOptions(project), output: join(project.directory, 'generated/card.pdf') }, /must end in .png/u],
      [{ ...pngOptions(project), output: '' }, /Filesystem locations must be non-empty/u],
      [{ ...pngOptions(project), assets: { image: 'missing.svg' } }, /Browser artifact asset cannot be accessed/u],
      [{ ...pngOptions(project), assets: { image: directoryAsset } }, /Browser artifact asset must be a file/u],
    ];

    for (const [options, expectation] of fixtures) {
      await assert.rejects(
        async () =>
          await generateBrowserArtifact(options, {
            compile: async () => {
              compiled = true;
            },
            loadPlaywright: browser.loadPlaywright,
          }),
        expectation,
      );
    }

    assert.equal(compiled, false);
  } finally {
    await rm(project.directory, { force: true, recursive: true });
  }
});

test('cleans isolated work directories after build and launch failures', async () => {
  const project = await createProject();
  let failedBuildDirectory;
  let failedLaunchDirectory;

  try {
    await assert.rejects(
      async () =>
        await generateBrowserArtifact(pngOptions(project), {
          compile: async (options) => {
            failedBuildDirectory = dirname(options.outputDirectory);

            throw new Error('compile failed');
          },
        }),
      /compile failed/u,
    );

    const launchBrowser = createBrowser({ launchError: new Error('launch failed') });

    await assert.rejects(
      async () =>
        await generateBrowserArtifact(pngOptions(project), {
          compile: async (options) => {
            failedLaunchDirectory = dirname(options.outputDirectory);

            await compilePage(launchBrowser.observations, options);
          },
          loadPlaywright: launchBrowser.loadPlaywright,
        }),
      /launch failed/u,
    );

    await assert.rejects(async () => await stat(failedBuildDirectory));
    await assert.rejects(async () => await stat(failedLaunchDirectory));
  } finally {
    await rm(project.directory, { force: true, recursive: true });
  }
});
