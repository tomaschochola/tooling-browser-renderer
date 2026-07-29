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

import stylesheet from './browser-artifact-social-card.scss' with { type: 'css' };

export const BROWSER_ARTIFACT_SOCIAL_CARD_TAG_NAME = 'browser-artifact-social-card' as const;

export class BrowserArtifactSocialCardElement extends HTMLElement {
  readonly #headingElement: HTMLHeadingElement;
  readonly #imageElement: HTMLImageElement;

  #heading = '';
  #imageSource = '';

  public constructor() {
    super();

    const document = this.ownerDocument;
    const root = this.attachShadow({
      mode: 'open',
    });
    const content = document.createElement('div');

    this.#imageElement = document.createElement('img');
    this.#headingElement = document.createElement('h1');

    this.#imageElement.alt = '';
    this.#imageElement.decoding = 'sync';
    this.#imageElement.fetchPriority = 'high';
    this.#imageElement.loading = 'eager';

    content.append(this.#imageElement, this.#headingElement);
    root.adoptedStyleSheets = [stylesheet];
    root.append(content);
  }

  public get heading(): string {
    return this.#heading;
  }

  public set heading(value: string) {
    if (this.#heading === value) {
      return;
    }

    this.#heading = value;
    this.#headingElement.textContent = value;
  }

  public get imageSource(): string {
    return this.#imageSource;
  }

  public set imageSource(value: string) {
    if (this.#imageSource === value) {
      return;
    }

    this.#imageSource = value;

    if (value === '') {
      this.#imageElement.removeAttribute('src');

      return;
    }

    this.#imageElement.src = value;
  }
}

export function defineBrowserArtifactSocialCard(registry: CustomElementRegistry): void {
  registry.define(BROWSER_ARTIFACT_SOCIAL_CARD_TAG_NAME, BrowserArtifactSocialCardElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'browser-artifact-social-card': BrowserArtifactSocialCardElement;
  }
}
