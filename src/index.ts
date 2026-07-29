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

export interface BrowserArtifactGenerationOptions {
  readonly allowNetwork?: boolean;
  readonly entries: readonly (string | URL)[];
  readonly outputDirectory: string | URL;
  readonly projectDirectory?: string | URL;
  readonly template?: string | URL;
  readonly temporaryDirectory?: string | URL;
  readonly timeout?: number;
}

export interface BrowserArtifactDefaultEntries {
  readonly entries: readonly string[];
  readonly script: string;
  readonly stylesheet: string;
  readonly template: string;
}

export declare const browserArtifactDefaults: BrowserArtifactDefaultEntries;

export declare function generateBrowserArtifacts(options: BrowserArtifactGenerationOptions): Promise<void>;
