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
        streams.stderr.write(`tooling-browser-renderer: ${error instanceof Error ? error.message : String(error)}\n`);

        return 1;
    }
}
