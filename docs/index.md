---
layout: home
title: Visual feedback, ready for your coding agent
titleTemplate: false

hero:
  name: visdiff
  text: Visual feedback.<br>Agent-ready tasks.
  tagline: Make the change in the browser. Let your coding agent make it real in source.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: How agents use tasks
      link: /guide/agent-workflow

features:
  - title: Work from the rendered page
    details: Select, move, resize, and adjust layouts in the app you already have running.
  - title: Keep the intent with the edit
    details: Add task and per-change notes so the agent understands what matters, not just what moved.
  - title: Preserve relationships
    details: Shared selection IDs connect multi-selected elements with changes to their common layout container.
  - title: Meet the agent where it works
    details: Read and clear tasks through simple CLI commands or MCP tools.
---

## Try Visdiff

Run the demo against a local development server to use the real browser overlay, source anchors, project task queue, and CLI/MCP agent workflow.

[Get started](/guide/getting-started)

## From browser to source change

**Browser overlay** → **Project queue** → **CLI / MCP agent** → **Source change** → **Verified task**

Visdiff captures context and observed visual changes. Your agent remains responsible for inspecting the source, choosing a maintainable implementation, and verifying it.

## Start here

- [Getting started](/guide/getting-started) — run the demo and configure a bundler.
- [Agent workflow](/guide/agent-workflow) — understand how to interpret and apply tasks safely.
- [CLI and MCP](/guide/cli-and-mcp) — connect an agent and manage its queue.
- [Task format](/reference/task-format) — inspect the fields passed to an agent.
- [Development](/guide/development) — run checks and work on the repository.
