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
import { help, parseArguments } from '../src/options.js';

test('describes both explicit artifact commands and the public input model', () => {
  assert.match(help, /tooling-browser-artifacts png OUTPUT --entry REQUEST/u);
  assert.match(help, /tooling-browser-artifacts pdf OUTPUT --entry REQUEST/u);
  assert.match(help, /Entries execute in the supplied order/u);
  assert.match(help, /globalThis\.browserArtifact/u);
  assert.match(help, /--data NAME=VALUE/u);
  assert.match(help, /top \[right\] \[bottom\] \[left\]/u);
  assert.deepEqual(parseArguments(['--help']), { type: 'help' });
  assert.deepEqual(parseArguments(['png', '--help']), { type: 'help' });
});

test('parses a complete PNG command', () => {
  assert.deepEqual(
    parseArguments([
      'png',
      'generated/card.png',
      '--entry',
      './card.tsx',
      '--entry',
      '@scope/package/product',
      '--asset',
      'image=logo.svg',
      '--asset',
      'background=https://example.com/background.png',
      '--data',
      'open-graph-line-1=Městysané',
      '--data',
      'query=a=b',
      '--width',
      '600',
      '--height',
      '315',
      '--pixel-ratio',
      '2',
      '--transparent',
      '--wait-for-selector',
      '[data-ready]',
      '--allow-network',
      '--timeout',
      '120000',
    ]),
    {
      allowNetwork: true,
      assets: {
        background: 'https://example.com/background.png',
        image: 'logo.svg',
      },
      data: {
        'open-graph-line-1': 'Městysané',
        query: 'a=b',
      },
      entries: ['./card.tsx', '@scope/package/product'],
      output: 'generated/card.png',
      pixelRatio: 2,
      timeout: 120_000,
      transparent: true,
      type: 'png',
      viewport: {
        height: 315,
        width: 600,
      },
      waitForSelector: '[data-ready]',
    },
  );
});

test('applies PNG defaults', () => {
  assert.deepEqual(parseArguments(['png', 'card.png', '--entry', './card.js', '--width', '64', '--height', '32']), {
    allowNetwork: false,
    entries: ['./card.js'],
    output: 'card.png',
    pixelRatio: 1,
    timeout: 60_000,
    transparent: false,
    type: 'png',
    viewport: {
      height: 32,
      width: 64,
    },
  });
});

test('expands CSS-compatible PDF margin shorthand', () => {
  const fixtures = [
    ['1mm', { bottom: '1mm', left: '1mm', right: '1mm', top: '1mm' }],
    ['1mm 2mm', { bottom: '1mm', left: '2mm', right: '2mm', top: '1mm' }],
    ['1mm 2mm 3mm', { bottom: '3mm', left: '2mm', right: '2mm', top: '1mm' }],
    ['1mm 2mm 3mm 4mm', { bottom: '3mm', left: '4mm', right: '2mm', top: '1mm' }],
  ];

  for (const [margin, expected] of fixtures) {
    const options = parseArguments(['pdf', 'report.pdf', '--entry', './report.js', '--format', 'A4', '--margin', margin]);

    assert.deepEqual(options.margin, expected);
  }
});

test('parses format-owned and CSS-owned PDF geometry', () => {
  assert.deepEqual(parseArguments(['pdf', 'report.pdf', '--entry', './report.js', '--format', 'Letter', '--landscape']), {
    allowNetwork: false,
    entries: ['./report.js'],
    landscape: true,
    output: 'report.pdf',
    paper: {
      format: 'Letter',
      type: 'format',
    },
    timeout: 60_000,
    type: 'pdf',
  });

  assert.deepEqual(parseArguments(['pdf', 'report.pdf', '--entry', './report.js', '--css-page-size']), {
    allowNetwork: false,
    entries: ['./report.js'],
    output: 'report.pdf',
    paper: {
      type: 'css',
    },
    timeout: 60_000,
    type: 'pdf',
  });
});

const invalidArguments = [
  [[], /Expected a command/u],
  [['png'], /Expected a command/u],
  [['png', ''], /Output must not be empty/u],
  [['jpeg', 'card.jpg'], /Unknown command/u],
  [['png', 'card.png', '--width', '10', '--height', '10'], /At least one --entry is required/u],
  [['png', 'card.png', '--entry', '', '--width', '10', '--height', '10'], /--entry must not be empty/u],
  [['png', 'card.png', '--entry', './card.js', '--asset', 'image', '--width', '10', '--height', '10'], /NAME=SOURCE/u],
  [['png', 'card.png', '--entry', './card.js', '--asset', 'IMAGE=logo.svg', '--width', '10', '--height', '10'], /NAME=SOURCE/u],
  [['png', 'card.png', '--entry', './card.js', '--asset', 'image=', '--width', '10', '--height', '10'], /NAME=SOURCE/u],
  [['png', 'card.png', '--entry', './card.js', '--asset', 'image=a.svg', '--asset', 'image=b.svg', '--width', '10', '--height', '10'], /Duplicate browser artifact asset/u],
  [['png', 'card.png', '--entry', './card.js', '--data', 'text', '--width', '10', '--height', '10'], /NAME=VALUE/u],
  [['png', 'card.png', '--entry', './card.js', '--data', 'Text=value', '--width', '10', '--height', '10'], /NAME=VALUE/u],
  [['png', 'card.png', '--entry', './card.js', '--data', 'text=', '--width', '10', '--height', '10'], /NAME=VALUE/u],
  [['png', 'card.png', '--entry', './card.js', '--data', 'text=a', '--data', 'text=b', '--width', '10', '--height', '10'], /Duplicate browser artifact data/u],
  [['png', 'card.png', '--entry', './card.js', '--width', '0', '--height', '10'], /--width must be a positive integer/u],
  [['png', 'card.png', '--entry', './card.js', '--height', '10'], /--width must be a positive integer/u],
  [['png', 'card.png', '--entry', './card.js', '--width', '16385', '--height', '10'], /--width must not exceed/u],
  [['png', 'card.png', '--entry', './card.js', '--width', '999999999999999999999999', '--height', '10'], /--width must not exceed/u],
  [['png', 'card.png', '--entry', './card.js', '--width', '10', '--height', 'x'], /--height must be a positive integer/u],
  [['png', 'card.png', '--entry', './card.js', '--width', '10', '--height', '10', '--pixel-ratio', 'x'], /--pixel-ratio must be a decimal/u],
  [['png', 'card.png', '--entry', './card.js', '--width', '10', '--height', '10', '--pixel-ratio', '5'], /--pixel-ratio must be from/u],
  [['png', 'card.png', '--entry', './card.js', '--width', '10', '--height', '10', '--pixel-ratio', '0.09'], /--pixel-ratio must be from/u],
  [['png', 'card.png', '--entry', './card.js', '--width', '3', '--height', '3', '--pixel-ratio', '1.5'], /whole output dimensions/u],
  [['png', 'card.png', '--entry', './card.js', '--width', '2', '--height', '3', '--pixel-ratio', '1.5'], /whole output dimensions/u],
  [['png', 'card.png', '--entry', './card.js', '--width', '10000', '--height', '10000', '--pixel-ratio', '2'], /safety limit/u],
  [['png', 'card.png', '--entry', './card.js', '--width', '1', '--height', '10000', '--pixel-ratio', '2'], /safety limit/u],
  [['png', 'card.png', '--entry', './card.js', '--width', '10001', '--height', '10000'], /safety limit/u],
  [['png', 'card.png', '--entry', './card.js', '--width', '10', '--height', '10', '--pixel-ratio', '1e999'], /--pixel-ratio must be a decimal/u],
  [['png', 'card.png', '--entry', './card.js', '--width', '10', '--height', '10', '--timeout', '600001'], /--timeout must not exceed/u],
  [['png', 'card.png', '--entry', './card.js', '--width', '10', '--height', '10', '--wait-for-selector', ''], /--wait-for-selector must not be empty/u],
  [['png', 'card.png', '--entry', './card.js', '--width', '10', '--height', '10', '--format', 'A4'], /Unsupported option/u],
  [['png', 'card.png', '--entry', './card.js', '--width', '10', '--height', '10', '--product', 'open-graph'], /Unknown option/u],
  [['pdf', 'report.pdf', '--entry', './report.js'], /Choose exactly one PDF paper source/u],
  [['pdf', 'report.pdf', '--entry', './report.js', '--format', 'A4', '--css-page-size'], /Choose exactly one/u],
  [['pdf', 'report.pdf', '--entry', './report.js', '--format', ''], /--format must not be empty/u],
  [['pdf', 'report.pdf', '--entry', './report.js', '--format', 'Unknown'], /Unsupported PDF format/u],
  [['pdf', 'report.pdf', '--entry', './report.js', '--css-page-size', '--landscape'], /cannot be combined/u],
  [['pdf', 'report.pdf', '--entry', './report.js', '--css-page-size', '--margin', '1mm'], /cannot be combined/u],
  [['pdf', 'report.pdf', '--entry', './report.js', '--format', 'A4', '--margin', ''], /--margin/u],
  [['pdf', 'report.pdf', '--entry', './report.js', '--format', 'A4', '--margin', '1mm 2mm 3mm 4mm 5mm'], /one through four/u],
  [['pdf', 'report.pdf', '--entry', './report.js', '--format', 'A4', '--margin=-1mm'], /non-negative dimensions/u],
  [['pdf', 'report.pdf', '--entry', './report.js', '--format', 'A4', '--margin', '1'], /non-negative dimensions/u],
  [['pdf', 'report.pdf', '--entry', './report.js', '--format', 'A4', '--transparent'], /Unsupported option/u],
];

for (const [arguments_, expectation] of invalidArguments) {
  test(`rejects invalid arguments: ${arguments_.join(' ')}`, () => {
    assert.throws(() => parseArguments(arguments_), expectation);
  });
}
