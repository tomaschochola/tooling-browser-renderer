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
import { executeCli } from '../src/command.js';

function createStreams() {
  const output = {
    stderr: '',
    stdout: '',
  };

  return {
    output,
    streams: {
      stderr: {
        write(value) {
          output.stderr += value;
        },
      },
      stdout: {
        write(value) {
          output.stdout += value;
        },
      },
    },
  };
}

test('prints help without generating an artifact', async () => {
  const { output, streams } = createStreams();
  let generated = false;

  const status = await executeCli(['--help'], streams, async () => {
    generated = true;
  });

  assert.equal(status, 0);
  assert.equal(generated, false);
  assert.match(output.stdout, /^Usage:/u);
  assert.equal(output.stderr, '');
});

test('passes parsed options to the generator', async () => {
  const { output, streams } = createStreams();
  let received;

  const status = await executeCli(['png', 'card.png', '--entry', './card.js', '--width', '64', '--height', '32'], streams, async (options) => {
    received = options;
  });

  assert.equal(status, 0);
  assert.equal(received.type, 'png');
  assert.equal(received.output, 'card.png');
  assert.deepEqual(received.viewport, {
    height: 32,
    width: 64,
  });
  assert.deepEqual(output, {
    stderr: '',
    stdout: '',
  });
});

test('reports argument and generator failures without a stack trace', async () => {
  const invalid = createStreams();
  const failed = createStreams();
  const nonError = createStreams();

  assert.equal(await executeCli([], invalid.streams), 1);
  assert.match(invalid.output.stderr, /^tooling-browser-renderer: Expected a command/u);

  assert.equal(
    await executeCli(['png', 'card.png', '--entry', './card.js', '--width', '64', '--height', '32'], failed.streams, async () => {
      throw new Error('generation failed');
    }),
    1,
  );
  assert.equal(failed.output.stderr, 'tooling-browser-renderer: generation failed\n');

  assert.equal(
    await executeCli(['png', 'card.png', '--entry', './card.js', '--width', '64', '--height', '32'], nonError.streams, async () => {
      throw 'non-error';
    }),
    1,
  );
  assert.equal(nonError.output.stderr, 'tooling-browser-renderer: non-error\n');
});
