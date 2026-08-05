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

import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import HtmlMinimizerPlugin from 'html-minimizer-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import ImageMinimizerPlugin from 'image-minimizer-webpack-plugin';
import JsonMinimizerPlugin from 'json-minimizer-webpack-plugin';
import { createRequire } from 'node:module';
import TerserPlugin from 'terser-webpack-plugin';
import webpack from 'webpack';

const assetResourceQuery = /^\?(?:asset|inline|resource|source)$/;
const require = createRequire(import.meta.url);
const htmlLoader = require.resolve('html-loader');
const postcssLoader = require.resolve('postcss-loader');
const sassLoader = require.resolve('sass-loader');
const typeScriptLoader = require.resolve('ts-loader');

function createConfiguration({
  entries,
  outputDirectory,
  projectDirectory,
  template,
}) {
  const styleLoaders = [
    {
      loader: postcssLoader,
    },
    {
      loader: sassLoader,
    },
  ];

  return {
    bail: true,
    context: projectDirectory,
    devtool: false,
    entry: {
      'browser-artifacts': entries,
    },
    experiments: {
      css: true,
      futureDefaults: false,
      html: false,
      typescript: false,
    },
    mode: 'production',
    module: {
      rules: [
        {
          test: /\.(tsx|mts|ts|cts|jsx|mjs|js|cjs)$/i,
          exclude: [
            /node_modules[\\/]core-js/u,
            /node_modules[\\/]webpack[\\/]buildin/u,
          ],
          resourceQuery: {
            not: [/raw/u],
          },
          use: [
            {
              loader: typeScriptLoader,
              options: {
                allowTsInNodeModules: true,
                compilerOptions: {
                  allowArbitraryExtensions: true,
                  allowJs: true,
                  checkJs: false,
                  declaration: false,
                  declarationMap: false,
                  maxNodeModuleJsDepth: 0,
                  module: 'preserve',
                  moduleResolution: 'bundler',
                  noEmit: false,
                  resolveJsonModule: true,
                  sourceMap: false,
                  target: 'ES2025',
                },
                onlyCompileBundledFiles: true,
                transpileOnly: true,
              },
            },
          ],
        },
        {
          test: /\.(sass|scss|css)$/i,
          oneOf: [
            {
              resourceQuery: assetResourceQuery,
              use: styleLoaders,
            },
            {
              resourceQuery: {
                not: [/raw/u],
              },
              type: 'css/auto',
              use: styleLoaders,
            },
          ],
        },
        {
          test: /\.(html|php)$/i,
          resourceQuery: {
            not: [/raw/u, assetResourceQuery],
          },
          use: [
            {
              loader: htmlLoader,
            },
          ],
        },
        {
          resourceQuery: /^\?source$/u,
          type: 'asset/source',
        },
        {
          resourceQuery: /^\?resource$/u,
          type: 'asset/resource',
        },
        {
          resourceQuery: /^\?inline$/u,
          type: 'asset/inline',
        },
        {
          resourceQuery: /^\?asset$/u,
          type: 'asset',
        },
      ],
    },
    optimization: {
      minimizer: [
        new TerserPlugin({
          extractComments: false,
          minimizerOptions: {
            ecma: 2025,
            format: {
              comments: false,
            },
          },
        }),
        new CssMinimizerPlugin(),
        new HtmlMinimizerPlugin(),
        new JsonMinimizerPlugin(),
        new ImageMinimizerPlugin({
          generator: [
            {
              implementation: ImageMinimizerPlugin.sharpGenerate,
              options: {
                encodeOptions: {
                  avif: {
                    bitdepth: 8,
                    chromaSubsampling: '4:2:0',
                    effort: 9,
                    lossless: false,
                    quality: 60,
                  },
                },
              },
              preset: 'avif',
              type: 'import',
            },
            {
              implementation: ImageMinimizerPlugin.sharpGenerate,
              options: {
                encodeOptions: {
                  webp: {
                    alphaQuality: 100,
                    effort: 6,
                    lossless: false,
                    minSize: false,
                    mixed: false,
                    nearLossless: false,
                    preset: 'default',
                    quality: 90,
                    smartSubsample: true,
                  },
                },
              },
              preset: 'webp',
              type: 'import',
            },
            {
              implementation: ImageMinimizerPlugin.sharpGenerate,
              options: {
                encodeOptions: {
                  png: {
                    adaptiveFiltering: true,
                    colors: 256,
                    colours: 256,
                    compressionLevel: 9,
                    dither: 0.8,
                    effort: 10,
                    palette: true,
                    progressive: true,
                    quality: 100,
                  },
                },
              },
              preset: 'png',
              type: 'import',
            },
            {
              implementation: ImageMinimizerPlugin.sharpGenerate,
              options: {
                encodeOptions: {
                  jpg: {
                    chromaSubsampling: '4:4:4',
                    mozjpeg: true,
                    optimiseCoding: true,
                    optimiseScans: true,
                    optimizeCoding: true,
                    optimizeScans: true,
                    overshootDeringing: true,
                    progressive: true,
                    quality: 80,
                    quantisationTable: 2,
                    quantizationTable: 2,
                    trellisQuantisation: true,
                  },
                },
              },
              preset: 'jpg',
              type: 'import',
            },
          ],
          minimizer: [
            {
              implementation: ImageMinimizerPlugin.sharpMinify,
              options: {
                encodeOptions: {
                  avif: {
                    effort: 9,
                    lossless: true,
                  },
                  gif: {
                    effort: 10,
                  },
                  heif: {
                    effort: 9,
                    lossless: true,
                  },
                  jp2: {
                    lossless: true,
                  },
                  jpeg: {
                    quality: 100,
                  },
                  jxl: {
                    effort: 9,
                    lossless: true,
                  },
                  png: {
                    effort: 10,
                  },
                  tiff: {
                    quality: 100,
                  },
                  webp: {
                    effort: 6,
                    lossless: true,
                  },
                },
              },
            },
            {
              implementation: ImageMinimizerPlugin.svgoMinify,
              options: {
                encodeOptions: {
                  multipass: true,
                  plugins: ['preset-default'],
                },
              },
            },
          ],
        }),
      ],
      removeAvailableModules: true,
    },
    output: {
      assetModuleFilename: 'immutable.[contenthash][ext][query][fragment]',
      chunkFilename: 'immutable.[contenthash].js',
      clean: true,
      filename: 'immutable.[contenthash].js',
      path: outputDirectory,
      publicPath: './',
    },
    plugins: [
      new HtmlWebpackPlugin({
        chunks: 'all',
        filename: 'index.html',
        inject: true,
        template,
        xhtml: true,
      }),
    ],
    resolve: {
      extensions: ['.tsx', '.mts', '.ts', '.cts', '.jsx', '.mjs', '.js', '.cjs'],
    },
    target: ['web', 'es2025'],
  };
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

  if (statistics.hasErrors()) {
    throw new Error(
      `Browser artifact Webpack build failed:\n${statistics.toString({
        all: false,
        colors: false,
        errorDetails: true,
        errors: true,
        moduleTrace: true,
      })}`,
    );
  }
}
