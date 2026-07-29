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
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { browserArtifactDefaults, generateBrowserArtifacts } from '../src/index.js';

const execute = promisify(execFile);
const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));

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
