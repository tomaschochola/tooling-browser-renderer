# tooling-browser-renderer

Deterministic browser rendering for screenshots, social cards, and PDF documents.

## Stack

- Language: JavaScript ESM on Node 24
- Runtime: GNU/Linux, browsers via Playwright
- Libraries: playwright 1.x, webpack 5.x, sharp 0.x
- Package manager: npm

## Toolchain

- Format: prettier 3.x, trimmer
- Lint: eslint 10.x, stylelint 17.x
- Test: `node --test` + real Chromium smoke
- Audit: npm audit

## Devcontainer

- Base: official Node
- User: node
- Browsers install natively: chromium, firefox, webkit
- Sidecars: none
- Up: `make up`
- Execute: `devcontainer exec --workspace-folder . <command>`
- Down: `make down`

## Makefile

- `update` — refresh locks, only tool that may touch them
- `fix` — auto-fix, may dirty tree
- `check` — full gate: doctor + lint + analyze + test + audit
- `doctor` — tree and toolchain ok
- `lint` — eslint + stylelint + prettier + trimmer checks
- `analyze` — npm + type checks
- `test` — unit tests + Chromium smoke
- `audit` — dependency audit
- `postcreate` — first-time setup, runs automatically on create
- `stop` — stop container, keep it
- `down` — stop and remove container
- `clean` — drop generated files
- `distclean` — drop everything rebuildable
- `rebuild` — full rebuild, only when broken

## Layout

├── Makefile
├── .editorconfig
├── .devcontainer/
├── package.json
├── eslint.config.js
├── prettier.config.js
├── stylelint.config.js
├── tsconfig.json
├── LICENSE
├── AUTHORS.md
├── src/
│   └── cli.js
└── tests/
