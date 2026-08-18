# Browser Renderer

Deterministic Chromium rendering for PNG screenshots and PDF documents. The renderer compiles one HTML page with Webpack, waits for the page and its resources to become ready, and atomically publishes one validated artifact.

## Usage

Render a self-contained HTML document as an A4 PDF:

```sh
npm exec --no --ignore-scripts -- tooling-browser-renderer pdf \
  ./generated/poster.pdf \
  --template ./rendering/poster/index.html \
  --format A4
```

Render a custom HTML template with stylesheet and script entries:

```sh
npm exec --no --ignore-scripts -- tooling-browser-renderer png \
  ./generated/poster.png \
  --template ./rendering/poster/index.html \
  --entry ./rendering/poster/index.scss \
  --entry ./rendering/poster/index.js \
  --width 1200 \
  --height 630
```

Run `tooling-browser-renderer --help` for all options.

## Input contract

### HTML templates

`--template REQUEST` replaces the built-in empty document. A template can be the only input or can provide the document structure for additional entries. Local images referenced by loadable HTML attributes are processed by `html-loader`.

Declare application scripts and styles with repeatable `--entry` options. Do not reference them with `<script src>` or `<link rel="stylesheet">` in the template. Entries execute in the supplied order after the document has been parsed.

When `--template` is omitted, at least one entry is required and the entries are injected into the built-in document.

### Data and assets

`--data NAME=VALUE` exposes plain text and `--asset NAME=SOURCE` exposes bundled or literal asset URLs:

```js
const { assets, data } = globalThis.browserArtifact;

document.querySelector('[data-title]').textContent = data.title;
document.querySelector('[data-logo]').src = assets.logo;
```

Consume named inputs from an entry rather than from a synchronous inline template script. The renderer prepends the named-input bootstrap to the entry bundle, so the values exist before user entries execute.

For structured or file-based inputs, import them from an entry through Webpack instead of passing large values through the command line:

```js
import content from './content.txt?source';
import metadata from './metadata.json';
```

### Readiness

In every current document frame, the renderer waits for `globalThis.browserArtifact.ready`, fonts, decodable images, and two animation frames. It also waits for an optional `--wait-for-selector` in the main frame before capture. Assign a promise when rendering performs asynchronous work:

```js
const browserArtifact = (globalThis.browserArtifact ??= {
  assets: {},
  data: {},
});

browserArtifact.ready = (async () => {
  const response = await fetch('https://example.com/data.json');
  const data = await response.json();

  render(data);
})();
```

Network access is denied by default. Use `--allow-network` only when the page intentionally requires HTTP or HTTPS resources.

## PNG geometry

PNG output captures the explicit CSS viewport. Both dimensions are required:

```sh
tooling-browser-renderer png ./generated/card.png \
  --template ./card.html \
  --width 1200 \
  --height 630 \
  --pixel-ratio 2
```

## PDF geometry

Select exactly one paper source. Use a predefined format:

```sh
tooling-browser-renderer pdf ./generated/document.pdf \
  --template ./document.html \
  --format A4 \
  --margin '10mm 15mm'
```

Alternatively, own all page geometry in CSS:

```css
@page {
  margin: 10mm 15mm;
  size: 210mm 297mm;
}
```

```sh
tooling-browser-renderer pdf ./generated/document.pdf \
  --template ./document.html \
  --css-page-size
```

## Deterministic environment

Rendering uses Chromium with a fixed `en-US` locale, UTC timezone, light color scheme, reduced motion, blocked service workers, and offline operation unless network access is explicitly enabled. PDF pages execute in a fixed `1920 × 1080` Full HD browser viewport; paper dimensions remain controlled independently by `--format` or CSS `@page`.

After readiness, the renderer injects motion-blocking CSS into every current document frame and open shadow root, cancels accessible Web Animations, and allows cancellation callbacks and layout to settle for two rendering frames. It then checks resources in every frame again and rejects the render if any accessible animation is still running or pending instead of capturing a timing-dependent state. PNG capture also uses Chromium's animation disabling as a final safeguard.

Treat `browserArtifact.ready` as the boundary after which the document is in its final static state. Closed shadow roots must honor the reduced-motion preference themselves. Arbitrary JavaScript timers and rendering loops, canvas, video, animated image formats, current time, and randomness remain application responsibilities and are not frozen by the renderer.

`--timeout` applies independently to browser operations and resource readiness. It is not a total command deadline.
