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

import { parseArgs } from 'node:util';

const maximumDimension = 16_384;
const maximumPixels = 100_000_000;
const maximumTimeout = 10 * 60 * 1000;
const pdfDimensionPattern = /^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|in|cm|mm))$/u;
const pdfFormats = new Set(['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'Ledger', 'Legal', 'Letter', 'Tabloid']);

const commonOptions = new Set(['allow-network', 'asset', 'data', 'entry', 'template', 'timeout', 'wait-for-selector']);
const pdfOptions = new Set([...commonOptions, 'css-page-size', 'format', 'landscape', 'margin']);
const pngOptions = new Set([...commonOptions, 'height', 'pixel-ratio', 'transparent', 'width']);

export const help = `Usage:
  tooling-browser-renderer png OUTPUT [--template REQUEST] [--entry REQUEST ...] [OPTIONS]
  tooling-browser-renderer pdf OUTPUT [--template REQUEST] [--entry REQUEST ...] [OPTIONS]

Build an HTML template and optional Webpack entries, then render one deterministic browser artifact.
At least one template or entry is required.
Entries execute in the supplied order. Named inputs are exposed on globalThis.browserArtifact.

Input options:
      --template REQUEST        HTML template (default: built-in template)
      --entry REQUEST           Optional Webpack entry; repeatable
      --asset NAME=SOURCE       Named asset in browserArtifact.assets; repeatable
      --data NAME=VALUE         Named plain text in browserArtifact.data; repeatable
      --wait-for-selector CSS   Wait until a matching element is attached
      --allow-network           Permit HTTP and HTTPS requests
      --timeout MILLISECONDS    Per-operation browser timeout (default: 60000)
  -h, --help                    Show this help

PNG options:
      --width PIXELS            CSS viewport width
      --height PIXELS           CSS viewport height
      --pixel-ratio NUMBER      Device pixels per CSS pixel (default: 1)
      --transparent             Preserve a transparent background

PDF options (choose exactly one paper source):
      --format FORMAT           A0-A6, Ledger, Legal, Letter, or Tabloid
      --css-page-size           Use size and margins declared by CSS @page
      --margin DIMENSIONS       CSS shorthand: top [right] [bottom] [left]
      --landscape               Use landscape orientation
`;

const argumentOptions = {
  'allow-network': { type: 'boolean' },
  asset: { multiple: true, type: 'string' },
  'css-page-size': { type: 'boolean' },
  data: { multiple: true, type: 'string' },
  entry: { multiple: true, type: 'string' },
  format: { type: 'string' },
  height: { type: 'string' },
  help: { short: 'h', type: 'boolean' },
  landscape: { type: 'boolean' },
  margin: { type: 'string' },
  'pixel-ratio': { type: 'string' },
  template: { type: 'string' },
  timeout: { type: 'string' },
  transparent: { type: 'boolean' },
  'wait-for-selector': { type: 'string' },
  width: { type: 'string' },
};

function parsePositiveInteger(value, option, defaultValue, maximum = maximumDimension) {
  const resolved = value ?? defaultValue;

  if (resolved === undefined || !/^[1-9]\d*$/u.test(resolved)) {
    throw new TypeError(`${option} must be a positive integer.`);
  }

  const number = Number(resolved);

  if (!Number.isSafeInteger(number) || number > maximum) {
    throw new RangeError(`${option} must not exceed ${String(maximum)}.`);
  }

  return number;
}

function parseDecimal(value, option, minimum, maximum) {
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/u.test(value)) {
    throw new TypeError(`${option} must be a decimal number.`);
  }

  const number = Number(value);

  if (number < minimum || number > maximum) {
    throw new RangeError(`${option} must be from ${String(minimum)} through ${String(maximum)}.`);
  }

  return number;
}

function parseDimension(value, option) {
  if (!pdfDimensionPattern.test(value)) {
    throw new TypeError(`${option} must contain non-negative dimensions using px, in, cm, or mm.`);
  }

  return value;
}

function parseString(value, option) {
  if (value === '') {
    throw new TypeError(`${option} must not be empty.`);
  }

  return value;
}

function parseEntries(values) {
  return values?.map((entry) => parseString(entry, '--entry')) ?? [];
}

function parseAssignments(values, option, noun, valueName) {
  const assignments = {};

  for (const assignment of values ?? []) {
    const separator = assignment.indexOf('=');
    const name = separator === -1 ? '' : assignment.slice(0, separator);
    const value = separator === -1 ? '' : assignment.slice(separator + 1);

    if (!/^[a-z][a-z0-9-]*$/u.test(name) || value === '') {
      throw new TypeError(`${option} must use a non-empty lowercase NAME=${valueName} assignment.`);
    }

    if (Object.hasOwn(assignments, name)) {
      throw new TypeError(`Duplicate browser artifact ${noun}: ${name}.`);
    }

    assignments[name] = value;
  }

  return assignments;
}

function parseAssets(values) {
  return parseAssignments(values, '--asset', 'asset', 'SOURCE');
}

function parseData(values) {
  return parseAssignments(values, '--data', 'data', 'VALUE');
}

function parseMargin(value) {
  if (value === undefined) {
    return undefined;
  }

  const dimensions = parseString(value, '--margin').trim().split(/\s+/u);

  if (dimensions.length > 4) {
    throw new TypeError('--margin must contain one through four dimensions.');
  }

  const [first, second = first, third = first, fourth = second] = dimensions.map((dimension) => parseDimension(dimension, '--margin'));

  return {
    bottom: third,
    left: fourth,
    right: second,
    top: first,
  };
}

function parsePaper(values) {
  const hasFormat = values.format !== undefined;
  const usesCss = values['css-page-size'] ?? false;

  if (Number(hasFormat) + Number(usesCss) !== 1) {
    throw new TypeError('Choose exactly one PDF paper source: --format or --css-page-size.');
  }

  if (usesCss) {
    if (values.landscape || values.margin !== undefined) {
      throw new TypeError('--margin and --landscape cannot be combined with --css-page-size; declare page geometry in CSS @page.');
    }

    return {
      type: 'css',
    };
  }

  const format = parseString(values.format, '--format');

  if (!pdfFormats.has(format)) {
    throw new TypeError(`Unsupported PDF format: ${format}.`);
  }

  return {
    format,
    type: 'format',
  };
}

function assertSupportedOptions(values, supported) {
  const unsupported = Object.entries(values)
    .filter(([option, value]) => option !== 'help' && value !== undefined && !supported.has(option))
    .map(([option]) => `--${option}`);

  if (unsupported.length > 0) {
    throw new TypeError(`Unsupported option for this command: ${unsupported.join(', ')}.`);
  }
}

function parseCommon(values) {
  const assets = parseAssets(values.asset);
  const data = parseData(values.data);
  const entries = parseEntries(values.entry);
  const template = values.template === undefined ? undefined : parseString(values.template, '--template');

  if (entries.length === 0 && template === undefined) {
    throw new TypeError('At least one --template or --entry is required.');
  }

  const options = {
    allowNetwork: values['allow-network'] ?? false,
    entries,
    timeout: parsePositiveInteger(values.timeout, '--timeout', '60000', maximumTimeout),
  };

  if (Object.keys(assets).length > 0) {
    options.assets = assets;
  }

  if (Object.keys(data).length > 0) {
    options.data = data;
  }

  if (template !== undefined) {
    options.template = template;
  }

  if (values['wait-for-selector'] !== undefined) {
    options.waitForSelector = parseString(values['wait-for-selector'], '--wait-for-selector');
  }

  return options;
}

function parsePng(values, output) {
  assertSupportedOptions(values, pngOptions);

  const viewport = {
    height: parsePositiveInteger(values.height, '--height'),
    width: parsePositiveInteger(values.width, '--width'),
  };
  const pixelRatio = parseDecimal(values['pixel-ratio'] ?? '1', '--pixel-ratio', 0.1, 4);
  const outputWidth = viewport.width * pixelRatio;
  const outputHeight = viewport.height * pixelRatio;

  if (!Number.isSafeInteger(outputWidth) || !Number.isSafeInteger(outputHeight)) {
    throw new RangeError('--pixel-ratio must produce whole output dimensions.');
  }

  if (outputWidth > maximumDimension || outputHeight > maximumDimension || outputWidth * outputHeight > maximumPixels) {
    throw new RangeError('PNG output dimensions exceed the safety limit.');
  }

  return {
    ...parseCommon(values),
    output,
    pixelRatio,
    transparent: values.transparent ?? false,
    type: 'png',
    viewport,
  };
}

function parsePdf(values, output) {
  assertSupportedOptions(values, pdfOptions);

  const options = {
    ...parseCommon(values),
    output,
    paper: parsePaper(values),
    type: 'pdf',
  };

  if (options.paper.type === 'format') {
    const margin = parseMargin(values.margin);

    options.landscape = values.landscape ?? false;

    if (margin !== undefined) {
      options.margin = margin;
    }
  }

  return options;
}

export function parseArguments(arguments_) {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: arguments_,
    options: argumentOptions,
    strict: true,
  });

  if (values.help) {
    return {
      type: 'help',
    };
  }

  if (positionals.length !== 2) {
    throw new TypeError('Expected a command and one output file. Run with --help for usage.');
  }

  const [command, output] = positionals;

  if (command !== 'png' && command !== 'pdf') {
    throw new TypeError(`Unknown command: ${String(command)}.`);
  }

  if (output === '') {
    throw new TypeError('Output must not be empty.');
  }

  return command === 'png' ? parsePng(values, output) : parsePdf(values, output);
}
