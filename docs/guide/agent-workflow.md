# Agent workflow

Visdiff records a browser edit as task data. The agent inspects the project and implements the source change; CSS values are evidence, not a patch.

## First task in a project

1. Identify the framework, bundler, Vite config, and development command.
2. If Visdiff is not configured, add `visdiffVite()` before the existing React, Vue, or Svelte Vite plugin. Install `visdiff` only if it is missing.
3. Do not add source markers to app components. The Vite adapter adds development-only anchors for React JSX/TSX, Vue 3 templates, and Svelte 4/5 markup.
4. For other integrations, follow the [support matrix](/reference/adapters). Do not claim unsupported anchors or add a custom compiler integration without asking.
5. Tell the user how to start or restart the dev server. Wait for them to create and apply a visual edit; do not invent a task.

Do not repeat setup on later tasks unless project configuration changed.

## Process each task

1. Read the complete task, including task-level and edit-level notes. Notes are the source of user intent; if no note states the goal and the result is ambiguous, ask instead of guessing from CSS values or measurements.
2. Group changes by `selectionGroups.id`. `member` is a selected element; `layout-container` is their shared parent. `selectedCount` counts selected elements, not change records. Member entries can be absent when no direct member edits were made.
3. Inspect `element.source` and nearby code. Use selector, text, URL, viewport, and geometry as runtime context; do not paste them into source.
4. Interpret `from` → `to`, optional move `delta`, and optional before/after geometry as measurements of the observed browser result. They are not user intent or source instructions. Choose the smallest maintainable source change and preserve responsive behavior.
5. The captured viewport is where the result was observed, not permission to change only that breakpoint or remove behavior at other sizes. If responsive scope is unclear from the note and measurements, ask before choosing global or breakpoint-specific behavior.
6. Run relevant checks and verify at the captured viewport when possible.
7. Clear only IDs whose changes are implemented and verified. Leave incomplete, ambiguous, or unverified tasks pending.

If the queue is empty, report that and wait for a task.

## Multi-selection

A group can contain one or more `member` changes and one `layout-container` change. The latter describes a single edit to the common parent; it does not mean each selected member needs a source edit. Group IDs link changes within one task and are not source identifiers.
