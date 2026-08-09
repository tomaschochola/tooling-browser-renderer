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

import { generateBrowserArtifact } from './generate.js';
import { help, parseArguments } from './options.js';

export async function executeCli(arguments_, streams, generate = generateBrowserArtifact) {
  try {
    const options = parseArguments(arguments_);

    if (options.type === 'help') {
      streams.stdout.write(help);

      return 0;
    }

    await generate(options);

    return 0;
  } catch (error) {
    streams.stderr.write(`tooling-browser-artifacts: ${error instanceof Error ? error.message : String(error)}\n`);

    return 1;
  }
}
