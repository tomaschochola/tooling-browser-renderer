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

import { BabelConfigBuilder } from '@tomaschochola/tooling-babel';
import { WebpackConfigBuilder } from '@tomaschochola/tooling-webpack';
import webpack from 'webpack';

export function createWebpackConfiguration({ entries, outputDirectory, projectDirectory, template }) {
  const babel = new BabelConfigBuilder({
    mode: 'production',
  })
    .addPresetTypeScript()
    .addPresetReact()
    .toConfig();

  return new WebpackConfigBuilder({
    argv: {
      mode: 'production',
    },
  })
    .setContext(projectDirectory)
    .setDevtool(false)
    .setTarget(['web', 'es2025'])
    .setEntries(entries.length === 0 ? {} : { 'browser-artifact': entries })
    .setOutputPath(outputDirectory)
    .setPublicPath('./')
    .addBabelLoader({
      ...babel,
      babelrc: false,
      configFile: false,
    })
    .addStyleLoaders()
    .addHtmlLoader()
    .addAssetQueryRules()
    .addHtmlPlugin({ template })
    .setEcmaVersion(2025)
    .addTerserMinimizer()
    .addCssMinimizer()
    .addHtmlMinimizer()
    .addJsonMinimizer()
    .addImageMinimizer()
    .toConfig();
}

function runCompiler(compiler) {
  return new Promise((resolvePromise, rejectPromise) => {
    compiler.run((error, statistics) => {
      if (error !== null && error !== undefined) {
        rejectPromise(error);

        return;
      }

      if (statistics === undefined) {
        rejectPromise(new Error('Webpack completed without build statistics.'));

        return;
      }

      resolvePromise(statistics);
    });
  });
}

function closeCompiler(compiler) {
  return new Promise((resolvePromise, rejectPromise) => {
    compiler.close((error) => {
      if (error !== null && error !== undefined) {
        rejectPromise(error);

        return;
      }

      resolvePromise();
    });
  });
}

export async function compileBrowserPage(options, createCompiler = webpack) {
  const compiler = createCompiler(createWebpackConfiguration(options));

  let statistics;

  try {
    statistics = await runCompiler(compiler);
  } finally {
    await closeCompiler(compiler);
  }

  const hasErrors = statistics.hasErrors();
  const hasWarnings = statistics.hasWarnings();

  if (hasErrors || hasWarnings) {
    throw new Error(
      `Browser artifact Webpack build ${hasErrors ? 'failed' : 'produced warnings'}:\n${statistics.toString({
        all: false,
        colors: false,
        errorDetails: true,
        errors: true,
        moduleTrace: true,
        warnings: true,
      })}`,
    );
  }
}
