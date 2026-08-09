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

import '@fontsource-variable/inter-tight';
import './index.css';
import template from './template.html';

const imageRows = new Set(['1', '2', '3', 'auto']);
const scales = new Set(['auto', 'static']);
const textPositions = new Set(['bottom', 'left', 'right', 'top']);
const dataNames = new Set(['open-graph-image-rows', 'open-graph-line-1', 'open-graph-line-2', 'open-graph-line-3', 'open-graph-scale', 'open-graph-text-position']);

function readOption(data, name, defaultValue) {
  const value = data[name] ?? defaultValue;

  if (typeof value !== 'string' || value === '') {
    throw new TypeError(`Open Graph data must contain a non-empty string: ${name}.`);
  }

  return value;
}

function readLines(data) {
  const lines = [data['open-graph-line-1'], data['open-graph-line-2'], data['open-graph-line-3']];
  let missingLine = false;

  for (const [index, line] of lines.entries()) {
    if (line === undefined) {
      missingLine = true;

      continue;
    }

    if (missingLine) {
      throw new TypeError(`Open Graph text lines must be contiguous; line ${String(index + 1)} follows a missing line.`);
    }

    if (typeof line !== 'string' || line.trim() === '' || /[\r\n]/u.test(line)) {
      throw new TypeError(`Open Graph line ${String(index + 1)} must be one non-empty visual row.`);
    }
  }

  return lines.filter((line) => line !== undefined);
}

function assertKnownData(data) {
  const unknown = Object.keys(data).filter((name) => name.startsWith('open-graph-') && !dataNames.has(name));

  if (unknown.length > 0) {
    throw new TypeError(`Unknown Open Graph data: ${unknown.join(', ')}.`);
  }
}

function nextFrame() {
  return new Promise((resolvePromise) => {
    requestAnimationFrame(resolvePromise);
  });
}

function fitsEnvelope(content, envelope) {
  const bounds = content.getBoundingClientRect();

  return bounds.height <= envelope.clientHeight && bounds.width <= envelope.clientWidth && content.scrollHeight <= envelope.clientHeight && content.scrollWidth <= envelope.clientWidth;
}

function fitContent(content, envelope) {
  let maximum = Math.max(envelope.clientHeight, envelope.clientWidth);
  let minimum = 1;
  let selected = 0;

  while (minimum <= maximum) {
    const candidate = Math.floor((minimum + maximum) / 2);

    content.style.fontSize = `${String(candidate)}px`;

    if (fitsEnvelope(content, envelope)) {
      selected = candidate;
      minimum = candidate + 1;
    } else {
      maximum = candidate - 1;
    }
  }

  if (selected === 0) {
    throw new RangeError('Open Graph content cannot fit its envelope.');
  }

  content.style.fontSize = `${String(selected)}px`;
}

async function prepareLayout(content, envelope, image, scale, hasText) {
  await Promise.all([document.fonts.ready, image.decode()]);
  await nextFrame();

  if (scale === 'auto' && hasText) {
    fitContent(content, envelope);
  }

  if (!fitsEnvelope(content, envelope)) {
    throw new RangeError('Open Graph content exceeds its envelope; use automatic scaling or adjust the product styles.');
  }

  await nextFrame();

  document.documentElement.dataset.browserArtifactReady = '';
}

const browserArtifact = globalThis.browserArtifact;

if (browserArtifact === undefined || typeof browserArtifact !== 'object') {
  throw new TypeError('Open Graph requires browser artifact inputs.');
}

const assets = browserArtifact.assets ?? {};
const data = browserArtifact.data ?? {};
const imageSource = assets.image;

if (typeof imageSource !== 'string' || imageSource === '') {
  throw new TypeError('Open Graph requires --asset image=SOURCE.');
}

assertKnownData(data);

const lines = readLines(data);
const imageRowsOption = readOption(data, 'open-graph-image-rows', 'auto');
const scale = readOption(data, 'open-graph-scale', 'auto');
const textPosition = readOption(data, 'open-graph-text-position', 'right');

if (!imageRows.has(imageRowsOption)) {
  throw new TypeError(`Unsupported Open Graph image rows: ${imageRowsOption}.`);
}

if (!scales.has(scale)) {
  throw new TypeError(`Unsupported Open Graph scale: ${scale}.`);
}

if (!textPositions.has(textPosition)) {
  throw new TypeError(`Unsupported Open Graph text position: ${textPosition}.`);
}

const fragment = document.createRange().createContextualFragment(template);

document.body.replaceChildren(fragment);

const container = document.querySelector('.open-graph');
const content = document.querySelector('.open-graph-content');
const envelope = document.querySelector('.open-graph-envelope');
const image = document.querySelector('.open-graph-image');
const text = document.querySelector('.open-graph-text');
const resolvedImageRows = imageRowsOption === 'auto' ? Math.min(lines.length, 2) : Number(imageRowsOption);

container.dataset.openGraphImageRows = String(resolvedImageRows);
container.dataset.openGraphLineCount = String(lines.length);
container.dataset.openGraphScale = scale;
container.dataset.openGraphTextPosition = textPosition;

image.src = imageSource;

for (const value of lines) {
  const line = document.createElement('span');

  line.className = 'open-graph-line';
  line.textContent = value;
  text.append(line);
}

browserArtifact.ready = prepareLayout(content, envelope, image, scale, lines.length > 0);
