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
import test from 'node:test';
import { compileBrowserPage, createWebpackConfiguration } from '../src/webpack.js';

const options = {
  entries: ['/project/artifact.ts', '/project/artifact.scss'],
  outputDirectory: '/temporary/build',
  projectDirectory: '/project',
  template: '/project/artifact.html',
};

test('creates the optimized framework-neutral browser build', () => {
  const configuration = createWebpackConfiguration(options);

  assert.equal(configuration.mode, 'production');
  assert.deepEqual(configuration.target, ['web', 'es2025']);
  assert.equal(configuration.context, '/project');
  assert.equal(configuration.devtool, false);
  assert.deepEqual(configuration.entry, {
    'browser-artifact': options.entries,
  });
  assert.equal(configuration.output.path, '/temporary/build');
  assert.equal(configuration.output.publicPath, './');
  assert.deepEqual(
    configuration.optimization.minimizer.map(({ constructor }) => constructor.name),
    ['TerserPlugin', 'CssMinimizerPlugin', 'HtmlMinimizerPlugin', 'JsonMinimizerPlugin'],
  );
  assert.deepEqual(
    configuration.plugins.map(({ constructor }) => constructor.name),
    ['HtmlWebpackPlugin', 'ImageMinimizerPlugin'],
  );
  assert.equal(configuration.module.rules.length, 4);
});

test('creates an HTML-only browser build without a Webpack entry', () => {
  const configuration = createWebpackConfiguration({
    ...options,
    entries: [],
  });

  assert.deepEqual(configuration.entry, {});
  assert.equal(configuration.plugins[0].userOptions.template, options.template);
});

function createCompiler({ closeError, runError, statistics }) {
  return {
    close(callback) {
      callback(closeError);
    },
    run(callback) {
      callback(runError, statistics);
    },
  };
}

function createStatistics({ errors = false, warnings = false } = {}) {
  return {
    hasErrors() {
      return errors;
    },
    hasWarnings() {
      return warnings;
    },
    toString(configuration) {
      assert.deepEqual(configuration, {
        all: false,
        colors: false,
        errorDetails: true,
        errors: true,
        moduleTrace: true,
        warnings: true,
      });

      return 'diagnostics';
    },
  };
}

test('runs and closes a successful Webpack compiler', async () => {
  let received;

  await compileBrowserPage(options, (configuration) => {
    received = configuration;

    return createCompiler({
      statistics: createStatistics(),
    });
  });

  assert.equal(received.output.path, options.outputDirectory);
});

test('rejects Webpack execution, lifecycle, error, and warning failures', async () => {
  await assert.rejects(
    async () =>
      await compileBrowserPage(options, () =>
        createCompiler({
          runError: new Error('run failed'),
        }),
      ),
    /run failed/u,
  );

  await assert.rejects(
    async () =>
      await compileBrowserPage(options, () =>
        createCompiler({
          statistics: undefined,
        }),
      ),
    /without build statistics/u,
  );

  await assert.rejects(
    async () =>
      await compileBrowserPage(options, () =>
        createCompiler({
          closeError: new Error('close failed'),
          statistics: createStatistics(),
        }),
      ),
    /close failed/u,
  );

  await assert.rejects(
    async () =>
      await compileBrowserPage(options, () =>
        createCompiler({
          statistics: createStatistics({ errors: true }),
        }),
      ),
    /build failed:\ndiagnostics/u,
  );

  await assert.rejects(
    async () =>
      await compileBrowserPage(options, () =>
        createCompiler({
          statistics: createStatistics({ warnings: true }),
        }),
      ),
    /produced warnings:\ndiagnostics/u,
  );
});
