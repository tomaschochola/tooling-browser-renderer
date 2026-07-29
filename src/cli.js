#!/usr/bin/env node

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

import process from 'node:process';
import { parseArgs } from 'node:util';
import { browserArtifactDefaults, generateBrowserArtifacts } from './node.js';

const help = `Usage: browser-artifacts --entry FILE --output DIRECTORY [OPTIONS]

Build browser-rendered PNG and PDF artifacts.

Options:
  -e, --entry FILE              Webpack entry; repeat to add entries
  -o, --output DIRECTORY        Generated output directory
      --project-directory DIR   Base directory for relative paths (default: current directory)
      --template FILE           HTML template (default: built-in template)
      --temporary-directory DIR Parent for isolated working directories (default: system temporary directory)
      --timeout MILLISECONDS    Per-operation timeout (default: 60000)
      --allow-network           Permit HTTP and HTTPS requests while rendering
      --no-defaults             Omit the built-in font and global stylesheet entries
  -h, --help                    Show this help
`;

function parseTimeout(value) {
  if (!(/^[1-9]\d*$/u).test(value)) {
    throw new TypeError(`--timeout must be a positive integer: ${value}`);
  }

  return Number(value);
}

async function main() {
  const { values } = parseArgs({
    allowPositionals: false,
    options: {
      'allow-network': {
        default: false,
        type: 'boolean',
      },
      'entry': {
        multiple: true,
        short: 'e',
        type: 'string',
      },
      'help': {
        default: false,
        short: 'h',
        type: 'boolean',
      },
      'no-defaults': {
        default: false,
        type: 'boolean',
      },
      'output': {
        short: 'o',
        type: 'string',
      },
      'project-directory': {
        default: process.cwd(),
        type: 'string',
      },
      'template': {
        type: 'string',
      },
      'temporary-directory': {
        type: 'string',
      },
      'timeout': {
        default: '60000',
        type: 'string',
      },
    },
    strict: true,
  });

  if (values.help) {
    process.stdout.write(help);

    return;
  }

  if (values.entry === undefined || values.entry.length === 0) {
    throw new TypeError('At least one --entry is required.');
  }

  if (values.output === undefined || values.output === '') {
    throw new TypeError('--output is required.');
  }

  await generateBrowserArtifacts({
    allowNetwork: values['allow-network'],
    entries: [
      ...(values['no-defaults'] ? [] : browserArtifactDefaults.entries),
      ...values.entry,
    ],
    outputDirectory: values.output,
    projectDirectory: values['project-directory'],
    ...(values.template === undefined ? {} : { template: values.template }),
    ...(values['temporary-directory'] === undefined
      ? {}
      : {
          temporaryDirectory: values['temporary-directory'],
        }),
    timeout: parseTimeout(values.timeout),
  });
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
}
