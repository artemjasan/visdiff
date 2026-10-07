# visdiff

Visdiff turns visual changes in a running web app into source-aware tasks for coding agents. It provides a browser overlay, a CLI, and an MCP stdio server.

Browse the [Visdiff guide](https://artemjasan.github.io/visdiff/) for setup, the agent workflow, CLI/MCP reference, and task format. Check the [framework and bundler support matrix](https://artemjasan.github.io/visdiff/reference/adapters) before choosing an adapter.

## Install

```bash
npm install -D visdiff
```

Node.js requirement: `^20.19.0 || >=22.12.0`.

## Vite setup

Register `visdiffVite()` before the framework plugin so source locations are attached before compilation:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visdiffVite } from 'visdiff/vite'

export default defineConfig({
  plugins: [visdiffVite(), react()],
})
```

The adapter runs only during development. It injects the browser overlay and records tasks in `<vite-root>/.visdiff/tasks.json`.

Vite source anchors are supported for React JSX/TSX, Vue 3 SFC templates, and Svelte 4/5 markup. Register `visdiffVite()` before the framework plugin. Vue/Svelte elements created outside their templates may not have source anchors; task capture still includes runtime element context.

## Agent workflow

1. Open the running app and make visual edits with the overlay.
2. Add intent or per-change notes when helpful; click **Apply** to queue the task.
3. Read the task with the CLI or MCP. Inspect its source anchor and related styles; treat CSS `from`/`to` values as observed results, not source-code instructions.
4. Implement the smallest maintainable change and verify it in the app.
5. Clear only the task IDs that were successfully applied.

Tasks include the page URL, viewport, source location when available, runtime element context, CSS edits, notes, and links between changes from one multi-selection. The full agent guidance is available with `visdiff instructions` or the `visdiff_pending_tasks` MCP tool.

## CLI

```bash
npx -y visdiff tasks
npx -y visdiff instructions
npx -y visdiff clear <task-id> [task-id ...]
npx -y visdiff mcp
```

Passing IDs to `clear` removes only those tasks. `visdiff clear --all` (or bare `visdiff clear`) intentionally clears the entire queue. `visdiff status` summarizes pending tasks.

## MCP

Configure an MCP client to launch:

```bash
npx -y visdiff mcp
```

The stdio server provides `visdiff_pending_tasks` to read tasks and `visdiff_clear_tasks` to remove only specified task IDs.

## Other bundlers

Generic adapter entrypoints are `visdiff/rollup`, `visdiff/webpack`, `visdiff/rspack`, `visdiff/rsbuild`, `visdiff/rolldown`, `visdiff/esbuild`, `visdiff/farm`, and `visdiff/bun`. For example:

```ts
import { visdiffWebpack } from 'visdiff/webpack'

export default {
  plugins: [visdiffWebpack({ enabled: true })],
}
```

Generic adapters do not inject HTML. Add a development-only script tag using the endpoint URL printed at startup. React JSX/TSX anchors require the Visdiff transform to run before the framework JSX compiler. Vue and Svelte anchors are currently available through the Vite adapter only. See the [framework and bundler support matrix](https://artemjasan.github.io/visdiff/reference/adapters). Turbopack is not supported.

For the full setup, development, and architecture guide, see the [repository README](https://github.com/artemjasan/visdiff#readme).
