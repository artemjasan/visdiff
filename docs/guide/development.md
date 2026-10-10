# Development

## Requirements

- Node.js `>=22.12.0`
- npm

## Checks

```bash
npm ci
npm run check
npm run build
npm run docs:build
```

`npm run check` runs ESLint, TypeScript, package tests, task JSON golden tests for the queue/CLI/MCP, and HTTP endpoint integration tests. CI runs checks and package/docs builds on supported Node versions.

The browser tests exercise selection, keyboard editing, framework source capture, and saving against the React, Vue, and Svelte examples:

```bash
npx playwright install chromium
npm run test:e2e
```

The command builds the package and starts an isolated Vite server for each example. CI runs browser tests on Node 20.

After all checks pass on `main`, CI creates an annotated `build-<run>-<attempt>` tag. These build tags do not publish the npm package; releases use separate `v*` tags.

## Releases

Releases are tag-driven. Bump `version` in `packages/visdiff/package.json`, move the CHANGELOG `Unreleased` entries into a `## <version>` section, commit, then push a matching tag:

```bash
git tag v<version>
git push origin v<version>
```

`.github/workflows/release.yml` verifies the tag equals `v` + package version, runs the test suite and typecheck, builds, publishes with `npm publish --provenance`, packs the tarball, and creates a GitHub Release with it.

Auth: the repository needs a one-time `NPM_TOKEN` secret before the workflow can publish:

1. On npmjs.com → Account settings → Access tokens, create a token with publish permission for the package (grant permission for new packages the first time, since `visdiff` is not yet on the registry).
2. Add it to the repository: `gh secret set NPM_TOKEN` (or repository Settings → Secrets and variables → Actions).

No trusted-publisher configuration is required; the publish step passes the token via `NODE_AUTH_TOKEN` and attaches provenance, which needs the package `repository` field to match this GitHub repo.

## Main areas

- `packages/visdiff/src/client/` — browser selection, element editing, Layout tools, batch state, and geometry.
- `packages/visdiff/src/client/overlay.ts` — browser overlay UI.
- `packages/visdiff/src/source-inject.ts` — development source anchors for JSX/TSX, Vue SFC templates, and Svelte markup.
- `packages/visdiff/src/vite-plugin.ts` and `plugin.ts` — Vite and generic bundler adapters.
- `packages/visdiff/src/cli.ts` and `mcp.ts` — CLI and MCP agent interfaces.
- `packages/visdiff/src/queue.ts` — task validation and queue operations.
- `packages/visdiff/test/` — task contract and queue tests.
- `e2e/` — browser tests against the Vite React, Vue, and Svelte examples.
- `docs/` — VitePress documentation site.

## Documentation site

Run the docs locally with `npm run docs:dev`; build and preview with `npm run docs:build` and `npm run docs:preview`.

The site uses the `/visdiff/` base path for GitHub Pages. Deployment runs from the default branch through `.github/workflows/pages.yml`. In repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.
