# visdiff

A local visual-edit bridge between the browser and CLI coding agents. Make UI changes in the running page, collect them in a transparent change panel, then send one JSON batch to the project queue and MCP server.

**Status:** local prototype; the `visdiff` package is not published to npm yet, so `npx visdiff` cannot download it. Use the workspace commands below. Node.js requirement: `^20.19.0 || >=22.12.0` (required by unplugin 3.4).

## Run the example

From the repository root:

```bash
npm install
npm run build
npm run demo
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). On macOS, run `open http://127.0.0.1:5173/` to open it in your default browser.

1. Click the floating **visdiff** button at the bottom right.
2. Click an element. The overlay shows its source, for example `src/App.tsx:21:11`.
3. Drag the element or use its right, bottom, or corner resize handle. Every completed gesture is staged automatically; no per-edit save click.
4. Repeat on as many elements as you need; every gesture accumulates in the same batch. The translucent panel lists each CSS change separately, and `×` removes only that row. Drag its header to move it (the panel stays inside the viewport); **Hide** collapses it to a **Show changes** button at the same position.
5. Click **Apply** once to send the whole batch. The Vite terminal prints a summary, and the JSON batch is appended to `examples/vite-react/.visdiff/pending.json`.5. For a line-specific note, click the comment icon on any pending row to open a tiny inline dialog and attach a note to that exact change. The comment travels with the matching edit entry in the queued MCP task.
**Reset** reverts the current unsaved preview. **Esc** or `✕` cancels the current selection; already staged rows remain in the batch. **Clear** in the batch panel discards the whole unsent batch. After **Apply**, preview styles stay on the page until HMR replaces them with the agent's code changes.

Inspect or clear queued batches from the repository root:

```bash
npm exec --workspace examples/vite-react -- visdiff tasks
npm exec --workspace examples/vite-react -- visdiff clear
```

## Connect an MCP client

From the repository root, register the local stdio server with Claude Code:

```bash
claude mcp add visdiff -- npm exec --workspace examples/vite-react -- visdiff mcp
```

`visdiff_pending_tasks` returns queued batches. Each batch groups one or more elements, each with a source anchor and CSS `from`/`to` edits. After applying a batch, call `visdiff_clear_tasks` with that task's `ids` value; newer batches remain queued.

OpenCode, OMP, and other MCP clients that support local stdio can launch the same command: `npm exec --workspace examples/vite-react -- visdiff mcp`. Client-specific config syntax differs. After npm publication, replace the workspace command with `npx -y visdiff mcp`.

## Architecture

- `packages/visdiff/src/client.ts` — browser overlay, selection, drag/resize, accumulated change list.
- `packages/visdiff/src/source-inject.ts` — dev-only Babel transform adds `data-visdiff-src` to JSX/TSX before framework compilation. React 19 source anchors do not rely on private Fiber fields.
- `packages/visdiff/src/vite-plugin.ts` — Vite dev adapter: same-origin HTTP endpoint, client injection, and source transform.
- `packages/visdiff/src/plugin.ts` — universal unplugin factory for other supported bundlers.
- `packages/visdiff/src/mcp.ts` — stdio MCP tools for reading batches and removing applied task IDs.

Each element change records only explicitly manipulated properties (`transform`, `width`, `height`). The batch is agent context, not a source-code patch: the agent chooses the final CSS, Tailwind class, or component change.

## Use in another project

After npm publication:

```bash
npm install -D visdiff
```

For Vite, place `visdiffVite()` **before** `@vitejs/plugin-react` so the source marker is added before JSX compilation:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visdiffVite } from 'visdiff/vite'

export default defineConfig({
  plugins: [visdiffVite(), react()],
})
```

The Vite adapter runs only in dev mode. Generic unplugin subpaths are `visdiff/rollup`, `visdiff/webpack`, `visdiff/rspack`, `visdiff/rsbuild`, `visdiff/rolldown`, `visdiff/esbuild`, `visdiff/farm`, and `visdiff/bun`. Example:

```ts
import { visdiffWebpack } from 'visdiff/webpack'

export default {
  plugins: [visdiffWebpack({ enabled: true })],
}
```

Generic adapters start the endpoint only when `NODE_ENV=development` or `enabled: true` is passed. They do not inject HTML; add a dev-only `<script defer src="http://127.0.0.1:9090/__visdiff/client.js"></script>` tag. If the port is busy, the terminal prints the selected URL and script tag. The endpoint binds to `127.0.0.1` and only allows browser origins on loopback hosts. Turbopack is not supported.

## Development checks

```bash
npm install
npx tsc --noEmit -p packages/visdiff/tsconfig.json
npx tsc --noEmit -p examples/vite-react/tsconfig.json
npm run build
npm run demo
```
