# Agent workflow

Visdiff tasks are **context for an implementation**, not source-code patches. A task records the browser result; the agent inspects the codebase and decides how best to reproduce that result in source.

## First-time setup

When Visdiff is available to the agent but is not yet connected to the app, the agent should inspect the project before changing it.

1. Identify the framework, bundler, existing config, and development command.
2. For Vite + React, Vue 3, or Svelte, add `visdiffVite()` to the existing Vite config before the framework plugin. Add the `visdiff` dependency only if it is not already installed.
3. Do not add attributes or imports to application components. The Vite integration adds development-only source anchors automatically for these frameworks.
4. If the project uses another bundler/framework, check the [support matrix](/reference/adapters) and use only the documented adapter. Generic adapters need a manual client script; Vue/Svelte template anchors are currently Vite-only. Do not claim unsupported source anchors or build a custom compiler integration without asking.
5. Explain the one-time config/dependency change and ask the user to start or restart the development server. The user then opens the app, makes an edit with the overlay, and applies it to the queue.

This setup is done once. Do not repeat or duplicate it on later tasks unless the project configuration has changed.

## Recommended loop

1. **Read the whole task.** Include task-level and per-edit notes; they express user intent and constraints.
2. **Relate the edits.** Changes sharing `selectionGroups.id` came from one multi-selection. `member` identifies a selected element; `layout-container` identifies the common parent changed by Layout controls.
3. **Inspect the source.** Start with `element.source` and nearby styles. Use the selector, text, URL, and viewport as runtime context, not as strings to paste into source.
4. **Interpret the delta.** `from` → `to` is an observed CSS effect. It may not be the right implementation. Preserve responsive behavior and unrelated styling.
5. **Make the smallest maintainable change.** Prefer the project's existing styling and component patterns.
6. **Verify.** Run relevant tests or checks and inspect the app at the task viewport when possible.
7. **Clear selectively.** Remove only task IDs whose changes were implemented and verified. Leave ambiguous or unverified work pending and report the limitation.

If the queue is empty, report that there are no tasks and wait for the user to make and apply a visual edit. Do not infer a task from a screenshot or modify the app without a queued request.

## Why the task has both notes and CSS values

CSS deltas are useful evidence, but they do not explain why a user made the change. For example, moving two cards closer together might mean reducing a parent `gap`, changing margins, or adjusting a responsive rule. A task note can say which intent and constraints matter; source inspection determines the implementation.

## Multi-selection

Members and their common Layout container can appear as separate element changes. Group IDs tell the agent they belong together:

- `role: "member"` — an element explicitly selected by the user.
- `role: "layout-container"` — the shared parent targeted by Layout controls.

`selectedCount` is the number of selected elements, not the number of task changes. A `layout-container` entry represents one change to their shared parent; member entries may be absent if no direct edits were made to those elements. Treat group IDs as relationships within one task, not as source identifiers.

If the note, captured viewport, and CSS delta leave responsive scope unclear, ask before choosing between a breakpoint-specific and global change.
