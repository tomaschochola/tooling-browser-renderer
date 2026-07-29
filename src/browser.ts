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

export const browserArtifactRuntimeKey = '@tomaschochola/tooling-webpack/browser-artifacts';

export interface BrowserArtifactSize {
  readonly height: number;
  readonly width: number;
}

export interface BrowserArtifactPdfMargin {
  readonly bottom?: number | string;
  readonly left?: number | string;
  readonly right?: number | string;
  readonly top?: number | string;
}

export type BrowserArtifactPdfFormat =
  | 'A0'
  | 'A1'
  | 'A2'
  | 'A3'
  | 'A4'
  | 'A5'
  | 'A6'
  | 'Ledger'
  | 'Legal'
  | 'Letter'
  | 'Tabloid';

export interface BrowserArtifactPdfOptions {
  readonly displayHeaderFooter?: boolean;
  readonly footerTemplate?: string;
  readonly format?: BrowserArtifactPdfFormat;
  readonly headerTemplate?: string;
  readonly height?: number | string;
  readonly landscape?: boolean;
  readonly margin?: BrowserArtifactPdfMargin;
  readonly media?: 'print' | 'screen';
  readonly outline?: boolean;
  readonly pageRanges?: string;
  readonly preferCSSPageSize?: boolean;
  readonly printBackground?: boolean;
  readonly scale?: number;
  readonly tagged?: boolean;
  readonly width?: number | string;
}

export interface BrowserArtifactPngOptions {
  readonly transparent?: boolean;
}

export type BrowserArtifactCompose = (root: HTMLElement) => Promise<void> | void;

export interface BrowserArtifactDefinitions {
  readonly pdf: (
    output: string,
    viewport: BrowserArtifactSize,
    compose: BrowserArtifactCompose,
    options?: BrowserArtifactPdfOptions,
  ) => void;
  readonly png: (
    output: string,
    size: BrowserArtifactSize,
    compose: BrowserArtifactCompose,
    options?: BrowserArtifactPngOptions,
  ) => void;
}

interface BrowserArtifactBase {
  readonly compose: BrowserArtifactCompose;
  readonly output: string;
  readonly viewport: BrowserArtifactSize;
}

interface BrowserArtifactPdf extends BrowserArtifactBase {
  readonly options: BrowserArtifactPdfOptions;
  readonly type: 'pdf';
}

interface BrowserArtifactPng extends BrowserArtifactBase {
  readonly options: BrowserArtifactPngOptions;
  readonly type: 'png';
}

type BrowserArtifact = BrowserArtifactPdf | BrowserArtifactPng;

type BrowserArtifactMetadata =
  | Omit<BrowserArtifactPdf, 'compose'>
  | Omit<BrowserArtifactPng, 'compose'>;

interface BrowserArtifactRuntime {
  list(): readonly BrowserArtifactMetadata[];
  render(index: number): Promise<void>;
}

const maximumDimension = 16_384;
const maximumPixels = 100_000_000;
const artifacts: BrowserArtifact[] = [];
const outputs = new Set<string>();
let defined = false;

function validateOutput(output: string, extension: '.pdf' | '.png'): void {
  const segments = output.split('/');

  if (
    output === '' ||
    output.includes('\\') ||
    !output.toLowerCase().endsWith(extension) ||
    segments.some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new TypeError(`Browser artifact output must be a safe relative path ending in ${extension}: ${output}`);
  }
}

function validateSize(size: BrowserArtifactSize): void {
  if (
    !Number.isSafeInteger(size.width) ||
    !Number.isSafeInteger(size.height) ||
    size.width <= 0 ||
    size.height <= 0 ||
    size.width > maximumDimension ||
    size.height > maximumDimension ||
    size.width * size.height > maximumPixels
  ) {
    throw new RangeError(
      `Browser artifact dimensions are invalid or exceed the safety limit: ${String(size.width)}x${String(size.height)}`,
    );
  }
}

function findOrCreateRoot(): HTMLElement {
  const candidates = document.querySelectorAll('[data-browser-artifact-root]');

  if (candidates.length > 1) {
    throw new Error('The browser artifact template must not contain more than one artifact root.');
  }

  if (candidates.length === 1) {
    const candidate = candidates.item(0);

    if (!(candidate instanceof HTMLElement)) {
      throw new TypeError('The browser artifact root must be an HTML element.');
    }

    return candidate;
  }

  const root = document.createElement('div');
  root.setAttribute('data-browser-artifact-root', '');
  document.body.append(root);

  return root;
}

const runtime: BrowserArtifactRuntime = Object.freeze({
  list(): readonly BrowserArtifactMetadata[] {
    if (!defined) {
      throw new Error('Browser artifacts have not been defined.');
    }

    return artifacts.map((artifact) => {
      if (artifact.type === 'pdf') {
        return Object.freeze({
          options: Object.freeze({
            ...artifact.options,
            ...(artifact.options.margin === undefined
              ? {}
              : {
                  margin: Object.freeze({ ...artifact.options.margin }),
                }),
          }),
          output: artifact.output,
          type: artifact.type,
          viewport: Object.freeze({ ...artifact.viewport }),
        });
      }

      return Object.freeze({
        options: Object.freeze({ ...artifact.options }),
        output: artifact.output,
        type: artifact.type,
        viewport: Object.freeze({ ...artifact.viewport }),
      });
    });
  },

  async render(index: number): Promise<void> {
    if (!Number.isSafeInteger(index) || index < 0 || index >= artifacts.length) {
      throw new RangeError(`Unknown browser artifact index: ${String(index)}`);
    }

    const artifact = artifacts[index];

    if (artifact === undefined) {
      throw new RangeError(`Unknown browser artifact index: ${String(index)}`);
    }

    const root = findOrCreateRoot();

    await artifact.compose(root);
  },
});

const runtimeSymbol = Symbol.for(browserArtifactRuntimeKey);

if (Reflect.has(globalThis, runtimeSymbol)) {
  throw new Error(`Browser artifact runtime is already registered: ${browserArtifactRuntimeKey}`);
}

Reflect.set(globalThis, runtimeSymbol, runtime);

export function defineBrowserArtifacts(definition: (artifacts: BrowserArtifactDefinitions) => void): void {
  if (defined) {
    throw new Error('Browser artifacts may only be defined once per entry.');
  }

  const definitions: BrowserArtifactDefinitions = Object.freeze({
    pdf: (
      output: string,
      viewport: BrowserArtifactSize,
      compose: BrowserArtifactCompose,
      options: BrowserArtifactPdfOptions = {},
    ): void => {
      validateOutput(output, '.pdf');
      validateSize(viewport);

      if (outputs.has(output)) {
        throw new Error(`Browser artifact output is already defined: ${output}`);
      }

      if (typeof compose !== 'function') {
        throw new TypeError(`Browser artifact compose callback must be a function: ${output}`);
      }

      outputs.add(output);
      artifacts.push(
        Object.freeze({
          compose,
          options: Object.freeze({
            ...options,
            ...(options.margin === undefined
              ? {}
              : {
                  margin: Object.freeze({ ...options.margin }),
                }),
          }),
          output,
          type: 'pdf',
          viewport: Object.freeze({ ...viewport }),
        }),
      );
    },
    png: (
      output: string,
      size: BrowserArtifactSize,
      compose: BrowserArtifactCompose,
      options: BrowserArtifactPngOptions = {},
    ): void => {
      validateOutput(output, '.png');
      validateSize(size);

      if (outputs.has(output)) {
        throw new Error(`Browser artifact output is already defined: ${output}`);
      }

      if (typeof compose !== 'function') {
        throw new TypeError(`Browser artifact compose callback must be a function: ${output}`);
      }

      outputs.add(output);
      artifacts.push(
        Object.freeze({
          compose,
          options: Object.freeze({ ...options }),
          output,
          type: 'png',
          viewport: Object.freeze({ ...size }),
        }),
      );
    },
  });

  try {
    definition(definitions);

    if (artifacts.length === 0) {
      throw new Error('At least one browser artifact must be defined.');
    }

    defined = true;
  } catch (error) {
    artifacts.length = 0;
    outputs.clear();

    throw error;
  }
}

export * from './components/browser-artifact-print-page';
export * from './components/browser-artifact-social-card';
