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
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { browserArtifactDefaults, generateBrowserArtifacts } from '../src/index.js';

const execute = promisify(execFile);
const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
const artifacts = new URL('./artifacts.ts', import.meta.url);

test('exports the browser artifact programmatic API', () => {
  assert.equal(typeof generateBrowserArtifacts, 'function');
  assert.equal(browserArtifactDefaults.entries.length, 2);
  assert.equal(Object.isFrozen(browserArtifactDefaults), true);
  assert.equal(Object.isFrozen(browserArtifactDefaults.entries), true);
});

test('exposes concise browser artifact CLI help', async () => {
  const { stderr, stdout } = await execute(process.execPath, [cli, '--help']);

  assert.equal(stderr, '');
  assert.match(stdout, /^Usage: browser-artifacts --entry FILE --output DIRECTORY \[OPTIONS\]/u);
  assert.match(stdout, /--no-defaults/u);
});

test('rejects incomplete browser artifact CLI invocations', async () => {
  await assert.rejects(
    async () => await execute(process.execPath, [cli, '--entry', './artifact.ts']),
    {
      stderr: /--output is required/u,
    },
  );
});

test('generates validated PNG and PDF artifacts and replaces stale output', async () => {
  const projectDirectory = await mkdtemp(join(tmpdir(), 'tooling-browser-artifacts-test-'));
  const outputDirectory = join(projectDirectory, 'output');

  try {
    await mkdir(outputDirectory);
    await writeFile(join(outputDirectory, 'stale.txt'), 'stale');

    await generateBrowserArtifacts({
      entries: [...browserArtifactDefaults.entries, artifacts],
      outputDirectory,
      projectDirectory,
    });

    const png = await readFile(join(outputDirectory, 'images/card.png'));
    const pdf = await readFile(join(outputDirectory, 'documents/page.pdf'));

    assert.deepEqual(png.subarray(0, 8), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    assert.equal(png.readUInt32BE(16), 64);
    assert.equal(png.readUInt32BE(20), 32);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    await assert.rejects(async () => await readFile(join(outputDirectory, 'stale.txt')), {
      code: 'ENOENT',
    });
  } finally {
    await rm(projectDirectory, {
      force: true,
      recursive: true,
    });
  }
});
