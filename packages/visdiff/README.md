# visdiff

TypeScript-first browser overlay and MCP bridge for visual UI edits. The package is not published to npm yet; use the workspace commands in the repository README until then. Node.js requirement: `^20.19.0 || >=22.12.0`.

## Vite

Install `visdiff` and `@vitejs/plugin-react` as dev dependencies, then place `visdiffVite()` before the React plugin so source locations are injected before JSX compilation:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visdiffVite } from 'visdiff/vite'

export default defineConfig({
  plugins: [visdiffVite(), react()],
})
```

The adapter runs only in Vite serve mode. It injects the browser overlay, records batches in `<vite-root>/.visdiff/pending.json`, and prints every submitted batch in the dev-server terminal.

## Browser workflow

1. Click **visdiff**, then select and move/resize an element.
2. Each completed drag or resize is added automatically to the translucent panel; no save click per edit.
3. Select and change as many different elements as needed. The panel keeps a separate row for each CSS edit; `×` removes one row without discarding the rest. Click the comment icon on any row to attach a short note to that exact edit, then drag the header to reposition it within the viewport or click **Hide** and restore it with **Show changes** at the same position.
4. Click **Apply** once to send the accumulated batch. The task groups edits by element, source anchor, and viewport.

**Reset** reverts the current preview; **Esc**/`✕` cancel the current selection; **Clear** discards the full unsent batch. After Apply, preview styles stay until HMR replaces them with the agent's code changes.

## CLI and MCP

From the repository root:

```bash
npm exec --workspace examples/vite-react -- visdiff tasks
npm exec --workspace examples/vite-react -- visdiff clear
npm exec --workspace examples/vite-react -- visdiff mcp
```

After publication, the bin is available as `npx -y visdiff <command>`. The MCP stdio server exposes `visdiff_pending_tasks` and `visdiff_clear_tasks`; clear requires `{ "ids": ["..."] }` and removes only the selected batches.

## Other unplugin adapters

Generic adapter entrypoints are `visdiff/rollup`, `visdiff/webpack`, `visdiff/rspack`, `visdiff/rsbuild`, `visdiff/rolldown`, `visdiff/esbuild`, `visdiff/farm`, and `visdiff/bun`. For example:

```ts
import { visdiffWebpack } from 'visdiff/webpack'

export default {
  plugins: [visdiffWebpack({ enabled: true })],
}
```

Generic adapters start the standalone endpoint when `NODE_ENV=development` or `enabled: true` is passed. They do not inject HTML; add a dev-only script tag using the endpoint URL printed at startup. The endpoint binds to `127.0.0.1` and accepts browser origins on loopback hosts only. The JSX/TSX source transform is dev-only and must run before the framework JSX compiler. Turbopack is not supported.
