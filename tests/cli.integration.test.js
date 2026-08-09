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
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('renders optimized HTML, JavaScript, SCSS, PNG, and PDF through the public CLI', async () => {
  const project = await mkdtemp(join(tmpdir(), 'tooling-browser-artifacts-integration-'));

  try {
    await writeFile(
      join(project, 'artifact.ts'),
      `const heading: HTMLHeadingElement = document.createElement('h1');

heading.textContent = 'Browser artifact';
document.body.replaceChildren(heading);

requestAnimationFrame(() => {
  if (getComputedStyle(document.body).backgroundColor !== 'rgb(18, 52, 86)') {
    throw new Error('SCSS was not applied.');
  }

  heading.dataset.ready = '';
});
`,
    );
    await writeFile(
      join(project, 'artifact.scss'),
      `body {
  align-items: center;
  background: #123456;
  color: #ffffff;
  display: flex;
  justify-content: center;
  margin: 0;
}
`,
    );
    await writeFile(
      join(project, 'document.js'),
      `const heading = document.createElement('h1');

heading.textContent = 'PDF artifact';
document.body.replaceChildren(heading);
`,
    );
    await writeFile(
      join(project, 'document.scss'),
      `@page {
  size: 100mm 50mm;
}
`,
    );
    await execute(
      process.execPath,
      [cli, 'png', 'generated/card.png', '--entry', './artifact.ts', '--entry', './artifact.scss', '--width', '80', '--height', '40', '--pixel-ratio', '2', '--wait-for-selector', '[data-ready]'],
      { cwd: project },
    );
    await execute(process.execPath, [cli, 'pdf', 'generated/document.pdf', '--entry', './document.js', '--entry', './document.scss', '--css-page-size'], { cwd: project });
    const png = await readFile(join(project, 'generated/card.png'));
    const pdf = await readFile(join(project, 'generated/document.pdf'));

    assert.deepEqual(png.subarray(0, pngSignature.length), pngSignature);
    assert.equal(png.readUInt32BE(16), 160);
    assert.equal(png.readUInt32BE(20), 80);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.equal(pdf.subarray(Math.max(0, pdf.length - 1024)).includes(Buffer.from('%%EOF')), true);
  } finally {
    await rm(project, {
      force: true,
      recursive: true,
    });
  }
});

test('renders the extensible Open Graph product from named assets and plain-text data', async () => {
  const project = await mkdtemp(join(tmpdir(), 'tooling-browser-artifacts-open-graph-'));

  try {
    await writeFile(
      join(project, 'logo.svg'),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="18" fill="#f9ca24" />
  <path d="M22 28h56v12H22zm0 32h56v12H22z" fill="#101114" />
</svg>
`,
    );
    await writeFile(
      join(project, 'open-graph.css'),
      `.open-graph {
  background: #123456;
}

.open-graph-content {
  font-size: 72px;
  gap: 32px;
}

.open-graph-line:nth-child(1) {
  color: #ffffff;
}

.open-graph-line:nth-child(2) {
  color: #f9ca24;
}

.open-graph-line:nth-child(3) {
  color: #9ad5ff;
}
`,
    );
    await writeFile(
      join(project, 'open-graph-check.js'),
      `const tolerance = 1;

function assertClose(actual, expected, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(\`${'${message}'}: expected ${'${String(expected)}'}, received ${'${String(actual)}'}.\`);
  }
}

function assertBefore(first, second, message) {
  if (first >= second) {
    throw new Error(message);
  }
}

void globalThis.browserArtifact.ready.then(() => {
  requestAnimationFrame(() => {
    const container = document.querySelector('.open-graph');
    const content = document.querySelector('.open-graph-content');
    const envelope = document.querySelector('.open-graph-envelope');
    const image = document.querySelector('.open-graph-image');
    const text = document.querySelector('.open-graph-text');
    const lines = [...document.querySelectorAll('.open-graph-line')];

    if (lines.map((line) => line.textContent).join('|') !== 'Městysané|Bouchalka|Zlonice') {
      throw new Error('The product did not preserve the three explicit text rows.');
    }

    if (container.dataset.openGraphImageRows !== '2' || container.dataset.openGraphTextPosition !== 'right') {
      throw new Error('The product did not apply its default layout.');
    }

    if (container.dataset.openGraphScale !== 'static' || !document.documentElement.hasAttribute('data-browser-artifact-ready')) {
      throw new Error('The product did not expose its completed static layout.');
    }

    if (!document.fonts.check('900 72px "Inter Tight Variable"')) {
      throw new Error('The bundled Inter Tight Variable font is not available.');
    }

    if (getComputedStyle(container).backgroundColor !== 'rgb(18, 52, 86)') {
      throw new Error('The consumer stylesheet did not override the product background.');
    }

    if (lines.map((line) => getComputedStyle(line).color).join('|') !== 'rgb(255, 255, 255)|rgb(249, 202, 36)|rgb(154, 213, 255)') {
      throw new Error('The consumer stylesheet did not independently style each text row.');
    }

    const containerBounds = container.getBoundingClientRect();
    const contentBounds = content.getBoundingClientRect();
    const lineBounds = lines.map((line) => line.getBoundingClientRect());
    let imageBounds = image.getBoundingClientRect();
    let textBounds = text.getBoundingClientRect();

    assertClose(imageBounds.height, lineBounds[1].bottom - lineBounds[0].top, 'Automatic two-row image sizing failed');
    assertClose(imageBounds.top, lineBounds[0].top, 'Cap-height image alignment failed');
    assertBefore(imageBounds.right, textBounds.left, 'Right-positioned text does not follow the image.');
    assertClose(contentBounds.x + contentBounds.width / 2, envelope.getBoundingClientRect().x + envelope.clientWidth / 2, 'The content is not horizontally centered in its envelope');
    assertClose(contentBounds.y + contentBounds.height / 2, envelope.getBoundingClientRect().y + envelope.clientHeight / 2, 'The content is not vertically centered in its envelope');
    assertClose(envelope.getBoundingClientRect().x + envelope.clientWidth / 2, containerBounds.x + containerBounds.width / 2, 'The envelope is not horizontally centered');
    assertClose(envelope.getBoundingClientRect().y + envelope.clientHeight / 2, containerBounds.y + containerBounds.height / 2, 'The envelope is not vertically centered');

    container.dataset.openGraphTextPosition = 'left';
    imageBounds = image.getBoundingClientRect();
    textBounds = text.getBoundingClientRect();
    assertBefore(textBounds.right, imageBounds.left, 'Left-positioned text does not precede the image.');

    container.dataset.openGraphTextPosition = 'top';
    imageBounds = image.getBoundingClientRect();
    textBounds = text.getBoundingClientRect();
    assertBefore(textBounds.bottom, imageBounds.top, 'Top-positioned text does not precede the image.');

    container.dataset.openGraphTextPosition = 'bottom';
    imageBounds = image.getBoundingClientRect();
    textBounds = text.getBoundingClientRect();
    assertBefore(imageBounds.bottom, textBounds.top, 'Bottom-positioned text does not follow the image.');

    container.dataset.openGraphTextPosition = 'right';
    container.dataset.openGraphImageRows = '1';
    imageBounds = image.getBoundingClientRect();
    textBounds = text.getBoundingClientRect();
    assertClose(imageBounds.height, lineBounds[0].height, 'One-row image sizing failed');
    assertClose(imageBounds.top, textBounds.top, 'One-row image alignment failed');

    container.dataset.openGraphImageRows = '3';
    imageBounds = image.getBoundingClientRect();
    assertClose(imageBounds.height, textBounds.height, 'Three-row image sizing failed');

    container.dataset.openGraphImageRows = '2';
    container.dataset.ready = '';
  });
});
`,
    );
    await writeFile(
      join(project, 'open-graph-auto-check.js'),
      `const productReady = globalThis.browserArtifact.ready;

globalThis.browserArtifact.ready = productReady.then(() => {
  const container = document.querySelector('.open-graph');
  const content = document.querySelector('.open-graph-content');
  const envelope = document.querySelector('.open-graph-envelope');
  const image = document.querySelector('.open-graph-image');
  const lines = [...document.querySelectorAll('.open-graph-line')];

  function fitsEnvelope() {
    const contentBounds = content.getBoundingClientRect();

    return contentBounds.height <= envelope.clientHeight && contentBounds.width <= envelope.clientWidth && content.scrollHeight <= envelope.clientHeight && content.scrollWidth <= envelope.clientWidth;
  }

  if (container.dataset.openGraphScale !== 'auto') {
    throw new Error('The product did not expose its completed automatic layout.');
  }

  if (!fitsEnvelope()) {
    throw new Error('The automatic layout exceeds its two-dimensional envelope.');
  }

  const selectedFontSize = Number.parseFloat(getComputedStyle(content).fontSize);

  content.style.fontSize = String(selectedFontSize + 1) + 'px';

  if (fitsEnvelope()) {
    throw new Error('The automatic layout did not select the largest fitting integer font size.');
  }

  content.style.fontSize = String(selectedFontSize) + 'px';

  const imageBounds = image.getBoundingClientRect();
  const firstLineBounds = lines[0].getBoundingClientRect();
  const lastCoveredLineBounds = lines[Number(container.dataset.openGraphImageRows) - 1].getBoundingClientRect();

  if (Math.abs(imageBounds.height - (lastCoveredLineBounds.bottom - firstLineBounds.top)) > 1 || Math.abs(imageBounds.top - firstLineBounds.top) > 1) {
    throw new Error('The automatically scaled image does not cover and align with its configured text rows.');
  }
});
`,
    );

    const packageScope = join(project, 'node_modules/@tomaschochola');

    await mkdir(packageScope, { recursive: true });
    await symlink(packageRoot, join(packageScope, 'tooling-browser-artifacts'), 'dir');

    await execute(
      process.execPath,
      [cli, 'png', 'generated/logo-only.png', '--entry', '@tomaschochola/tooling-browser-artifacts/products/open-graph', '--asset', 'image=logo.svg', '--width', '1200', '--height', '630'],
      { cwd: project },
    );
    await execute(
      process.execPath,
      [
        cli,
        'png',
        'generated/three-lines.png',
        '--entry',
        '@tomaschochola/tooling-browser-artifacts/products/open-graph',
        '--entry',
        './open-graph.css',
        '--entry',
        './open-graph-check.js',
        '--asset',
        'image=logo.svg',
        '--data',
        'open-graph-line-1=Městysané',
        '--data',
        'open-graph-line-2=Bouchalka',
        '--data',
        'open-graph-line-3=Zlonice',
        '--data',
        'open-graph-scale=static',
        '--width',
        '1200',
        '--height',
        '630',
        '--wait-for-selector',
        '[data-ready]',
      ],
      { cwd: project },
    );
    await execute(
      process.execPath,
      [
        cli,
        'png',
        'generated/auto.png',
        '--entry',
        '@tomaschochola/tooling-browser-artifacts/products/open-graph',
        '--entry',
        './open-graph.css',
        '--entry',
        './open-graph-auto-check.js',
        '--asset',
        'image=logo.svg',
        '--data',
        'open-graph-line-1=ŠpS',
        '--data',
        'open-graph-scale=auto',
        '--width',
        '1200',
        '--height',
        '630',
      ],
      { cwd: project },
    );
    await execute(
      process.execPath,
      [
        cli,
        'png',
        'generated/auto-long.png',
        '--entry',
        '@tomaschochola/tooling-browser-artifacts/products/open-graph',
        '--entry',
        './open-graph.css',
        '--entry',
        './open-graph-auto-check.js',
        '--asset',
        'image=logo.svg',
        '--data',
        'open-graph-line-1=MĚSTYSANÉ PRO ZLONICE',
        '--data',
        'open-graph-scale=auto',
        '--width',
        '1200',
        '--height',
        '630',
      ],
      { cwd: project },
    );
    await execute(
      process.execPath,
      [
        cli,
        'png',
        'generated/auto-three-rows.png',
        '--entry',
        '@tomaschochola/tooling-browser-artifacts/products/open-graph',
        '--entry',
        './open-graph.css',
        '--entry',
        './open-graph-auto-check.js',
        '--asset',
        'image=logo.svg',
        '--data',
        'open-graph-image-rows=3',
        '--data',
        'open-graph-line-1=BOUCHALKA.',
        '--data',
        'open-graph-line-2=ZLONICE.',
        '--data',
        'open-graph-line-3=TICHO.',
        '--data',
        'open-graph-scale=auto',
        '--width',
        '1200',
        '--height',
        '630',
      ],
      { cwd: project },
    );

    for (const artifact of ['auto-long.png', 'auto-three-rows.png', 'auto.png', 'logo-only.png', 'three-lines.png']) {
      const png = await readFile(join(project, 'generated', artifact));

      assert.deepEqual(png.subarray(0, pngSignature.length), pngSignature);
      assert.equal(png.readUInt32BE(16), 1200);
      assert.equal(png.readUInt32BE(20), 630);
    }
  } finally {
    await rm(project, {
      force: true,
      recursive: true,
    });
  }
});
