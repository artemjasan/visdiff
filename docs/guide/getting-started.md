# Getting started

**Requirements:** Node.js `>=22.12.0`.

## 1. Install

```bash
npm install -D visdiff
```

## 2. Configure Vite

Add `visdiffVite()` before your existing framework plugin:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visdiffVite } from 'visdiff/vite'

export default defineConfig({
  plugins: [visdiffVite(), react()],
})
```

The same order applies to Vue and Svelte. See [framework config examples and bundler support](/reference/adapters).

The overlay, source instrumentation, and local endpoint run only in development. The endpoint writes tasks to `.visdiff/tasks.json` in the project root.

## 3. Capture a task

Start or restart the dev server, open the app, then select and edit an element in the **visdiff** overlay. Add a note when intent or responsive constraints are not obvious, then click **Apply**.

Visdiff queues task data; it does not edit application source.

## 4. Connect your agent

From the project root, the CLI can read tasks and setup instructions:

```bash
npx -y visdiff tasks
npx -y visdiff instructions
```

Or register the local MCP server with Claude Code:

```bash
claude mcp add visdiff -- npx -y visdiff mcp
```

The agent inspects the source, implements and verifies the change, then clears only completed task IDs. See the [agent workflow](/guide/agent-workflow).
