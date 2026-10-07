# Development

## Requirements

- Node.js `^20.19.0 || >=22.12.0`
- npm

## Checks

```bash
npm ci
npm run check
npm run build
npm run docs:build
```

`npm run check` runs ESLint, TypeScript, and package tests. CI runs checks and package/docs builds on supported Node versions.

After all checks pass on `main`, CI creates an annotated `build-<run>-<attempt>` tag. These build tags do not publish the npm package; releases use separate `v*` tags.

## Main areas

- `packages/visdiff/src/client/` — browser selection, element editing, Layout tools, batch state, and geometry.
- `packages/visdiff/src/client/overlay.ts` — browser overlay UI.
- `packages/visdiff/src/source-inject.ts` — development source anchors for JSX/TSX, Vue SFC templates, and Svelte markup.
- `packages/visdiff/src/vite-plugin.ts` and `plugin.ts` — Vite and generic bundler adapters.
- `packages/visdiff/src/cli.ts` and `mcp.ts` — CLI and MCP agent interfaces.
- `packages/visdiff/src/queue.ts` — task validation and queue operations.
- `packages/visdiff/test/` — task contract and queue tests.
- `docs/` — VitePress documentation site.

## Documentation site

Run the docs locally with `npm run docs:dev`; build and preview with `npm run docs:build` and `npm run docs:preview`.

The site uses the `/visdiff/` base path for GitHub Pages. Deployment runs from the default branch through `.github/workflows/pages.yml`. In repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.
