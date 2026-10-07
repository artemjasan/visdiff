# Getting started

Visdiff connects a running development page with the source code behind it. Use the overlay to capture a visual edit, then let a CLI or MCP coding agent implement and verify the source change.

## Try the repository demo

Requirements: Node.js `^20.19.0 || >=22.12.0`.

From the repository root:

```bash
npm ci
npm run build
npm run demo
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173), click **visdiff**, and select an element.

The repository also includes [Vue](http://127.0.0.1:5174) and [Svelte](http://127.0.0.1:5175) examples. Start them in separate terminals with `npm run demo:vue` and `npm run demo:svelte`.

## Make and capture an edit

1. Drag a selected element, resize it with a handle, or use arrow keys to move it. **Shift + arrow** moves it by 10 px.
2. Shift-click to add or remove elements from a multi-selection.
3. If two or more selected elements share the same direct parent, open **Layout** in the selection toolbar to preview changes on that parent.
4. Add a task-level note for intent or constraints. Add a per-change comment from a row when a note applies to one specific edit.
5. Click **Apply** to save the batch into the local queue.

Edits accumulate until applied. **Reset** restores the current preview; **Esc** or **✕** cancels the current selection; **Clear** discards the unsent batch. Applying a task does not edit source files. Preview styles stay active until the app reloads or HMR replaces them.

The demo Vite adapter writes tasks under `examples/vite-react/.visdiff/`. That local task queue is ignored by Git.

## Configure Vite in another app

Install Visdiff alongside the Vite framework plugin already used by your app:

```bash
npm install -D visdiff
```

Register `visdiffVite()` before the framework plugin so source locations are attached before compilation:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visdiffVite } from 'visdiff/vite'

export default defineConfig({
  plugins: [visdiffVite(), react()],
})
```

The Vite adapter supports React JSX/TSX, Vue 3 single-file component templates, and Svelte 4/5 markup. For Vue and Svelte, use the framework's normal Vite plugin after `visdiffVite()`; its compiler is loaded only for matching source files.

The overlay and task endpoint are development-only. The Vite adapter injects them into the running app and keeps the task queue in the Vite project root.

For framework-specific config examples and the support matrix for other bundlers, see [Framework and bundler support](/reference/adapters).
