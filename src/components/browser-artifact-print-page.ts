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

import stylesheet from './browser-artifact-print-page.scss' with { type: 'css' };

export const BROWSER_ARTIFACT_PRINT_PAGE_TAG_NAME = 'browser-artifact-print-page' as const;

export class BrowserArtifactPrintPageElement extends HTMLElement {
  public constructor() {
    super();

    const document = this.ownerDocument;
    const root = this.attachShadow({
      mode: 'open',
    });
    const main = document.createElement('main');
    const slot = document.createElement('slot');

    main.append(slot);
    root.adoptedStyleSheets = [stylesheet];
    root.append(main);
  }
}

export function defineBrowserArtifactPrintPage(registry: CustomElementRegistry): void {
  registry.define(BROWSER_ARTIFACT_PRINT_PAGE_TAG_NAME, BrowserArtifactPrintPageElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'browser-artifact-print-page': BrowserArtifactPrintPageElement;
  }
}
