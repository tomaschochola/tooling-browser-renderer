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

function createConfiguration({
  entries,
  outputDirectory,
  projectDirectory,
  template,
}) {
  const babelConfig = new BabelConfigBuilder({
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
    .setEntries({
      'browser-artifacts': entries,
    })
    .setOutputPath(outputDirectory)
    .setPublicPath('./')
    .addBabelLoader({
      ...babelConfig,
      babelrc: false,
      configFile: false,
    })
    .addStyleLoaders()
    .addHtmlLoader()
    .addAssetQueryRules()
    .addHtmlPlugin({
      template,
    })
    .setEcmaVersion(2025)
    .addTerserMinimizer()
    .addCssMinimizer()
    .addHtmlMinimizer()
    .addJsonMinimizer()
    .addImageMinimizer()
    .toConfig();
}

export async function compileBrowserEntries(options) {
  const compiler = webpack(createConfiguration(options));

  let statistics;

  try {
    statistics = await new Promise((resolvePromise, rejectPromise) => {
      compiler.run((error, result) => {
        if (error !== null && error !== undefined) {
          rejectPromise(error);

          return;
        }

        if (result === undefined) {
          rejectPromise(new Error('Webpack completed without build statistics.'));

          return;
        }

        resolvePromise(result);
      });
    });
  } finally {
    await new Promise((resolvePromise, rejectPromise) => {
      compiler.close((error) => {
        if (error !== null && error !== undefined) {
          rejectPromise(error);

          return;
        }

        resolvePromise();
      });
    });
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
