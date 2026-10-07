# Development

## Requirements

- Node.js `^20.19.0 || >=22.12.0`
- npm

## Set up the repository

```bash
npm ci
npm run build
npm run demo
```

The demo is served at [http://127.0.0.1:5173](http://127.0.0.1:5173).

Vue and Svelte demos run with `npm run demo:vue` and `npm run demo:svelte` at ports `5174` and `5175`. Build all framework demos with `npm run build:examples`.

## Checks

```bash
npm run check
npm run build
npm run docs:build
```

`npm run check` runs ESLint, TypeScript checks for the package and examples, and package tests. CI runs lint on Node 20.19 and type checks, tests, and builds across the supported Node matrix.

## Main areas

- `packages/visdiff/src/client/` — browser selection, element editing, Layout tools, batch state, and geometry.
- `packages/visdiff/src/client/overlay.ts` — browser overlay UI.
- `packages/visdiff/src/source-inject.ts` — development source anchors for JSX/TSX, Vue SFC templates, and Svelte markup.
- `packages/visdiff/src/vite-plugin.ts` and `plugin.ts` — Vite and generic bundler adapters.
- `packages/visdiff/src/cli.ts` and `mcp.ts` — CLI and MCP agent interfaces.
- `packages/visdiff/src/queue.ts` — task validation and queue operations.
- `packages/visdiff/test/` — task contract and queue tests.
- `examples/vite-react/`, `examples/vite-vue/`, and `examples/vite-svelte/` — runnable framework demos using Vite and the Visdiff adapter.
- `docs/` — VitePress documentation site.

## Documentation site

Run the docs locally with `npm run docs:dev`. Build a production site with `npm run docs:build`; preview it with `npm run docs:preview`.

The site uses the `/visdiff/` base path for GitHub Pages. Deployment runs from the default branch through `.github/workflows/pages.yml`. In repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.
