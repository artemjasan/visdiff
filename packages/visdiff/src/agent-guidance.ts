export const AGENT_WORKFLOW = `Visdiff agent workflow

First-time project setup (do this once per project):
1. Inspect the project root, package scripts, framework, bundler, and existing configuration before changing anything.
2. If Visdiff is already integrated, do not add a duplicate plugin. Otherwise, for a Vite project using React, Vue 3, or Svelte, add the Visdiff Vite plugin to the existing Vite config before the framework plugin. Add the package dependency only if the project does not already have it.
3. Do not edit components or templates to add markers. Visdiff adds development-only source anchors automatically for supported Vite frameworks. Keep the integration out of production builds.
4. If the project uses another bundler or framework, do not claim equivalent source-anchor support. Use only an existing documented adapter, explain any manual client-script step, and report that source locations may be unavailable. Ask before introducing a custom compiler integration.
5. Tell the user what one-time config/dependency change was made and how to start or restart the development server. The user opens the running app, makes a visual edit, and applies it; do not invent a task if the queue is empty.

For each visual task:
1. Read every field of the task and every change/edit before modifying source. Read task.note and edit.note as user intent; notes may constrain the whole task or only one edit.
2. Treat url and viewport as the page and browser dimensions where the result was observed. Treat receivedAt as queue metadata, not implementation guidance or priority.
3. For each change, inspect element.source.file and its nearby component/styles first. Use source.line, source.column, and source.component as navigation hints; source can be null or incomplete. If so, search using element.text and inspect likely components. The selector and tag describe the rendered DOM and are runtime context, not reliable source-code selectors.
4. Interpret each edit's property, from, to, kind, optional delta, and change geometry together. "from" and "to" record observed CSS; delta records observed screen displacement for a move; geometry records viewport-relative bounds before and after the edit. All are evidence, not a source patch or proof of intent. Only task and edit notes express user intent.
5. Group related changes by selectionGroups.id. A "member" is a selected element; "layout-container" is its shared parent. selectedCount is the number of selected elements, not the number of task changes; a layout-container entry represents one change to their shared parent. Apply related changes together when appropriate.
6. Make the smallest maintainable source change that achieves the requested result. Preserve responsive behavior and unrelated styling. The viewport is where the result was observed, not permission to modify only that breakpoint or remove behavior at other sizes. If no note states the goal and the result is ambiguous, ask rather than guessing. If responsive scope is unclear, ask before choosing between a breakpoint-specific and global change.
7. Run relevant checks and verify the result in the application at the task viewport when possible. If a task is ambiguous or cannot be verified, leave it pending and report the limitation.
8. Remove only task IDs whose changes were implemented and verified. With the CLI, use "visdiff clear <task-id> [task-id ...]"; never use bare "visdiff clear" for partial completion. With MCP, pass only those IDs to visdiff_clear_tasks.

Task field reference:
- A pending queue is a list of independent tasks. Keep each task's id so only completed tasks are cleared.
- id identifies the task; receivedAt records when it entered the queue.
- url and viewport (width/height in CSS pixels) identify the browser context.
- note is an optional task-wide constraint; changes is the list of rendered elements and their edits.
- element.tag, selector, and text describe the rendered element. element.source identifies the source file and optional location/component, or is null if unavailable.
- Each edit records a CSS property, observed from/to values, an optional move/resize/style kind, and an optional edit-specific note. Missing optional fields are valid; do not infer intent that is not present.
- Move edits may include delta (x/y, CSS pixels) for the observed screen displacement. Changes may include before/after geometry bounds (x, y, width, height, CSS pixels relative to the viewport). These measurements describe what happened; they do not explain why.
- selectionGroups is optional. Its id links changes from one multi-selection operation; role distinguishes selected members from their shared layout container.

The CLI command "visdiff instructions" prints this workflow and field reference. MCP clients can read the "visdiff://agent-workflow" and "visdiff://task-format" resources.`

export const TASK_FORMAT_GUIDE = `Visdiff task format

The queue is a JSON array of independent tasks. A task describes a visual result captured in the browser; it is not a source patch.

Task fields:
- id: stable queue identifier. Use it when clearing only completed tasks.
- receivedAt: ISO timestamp when the task entered the queue.
- url: page URL where the edit was captured.
- viewport: browser width and height in CSS pixels.
- note: optional task-wide user intent or constraint.
- changes: one or more changed rendered elements.

Each change contains:
- element.tag: rendered DOM tag.
- element.selector: runtime selector for context, not necessarily a selector present in source.
- element.text: short rendered text context that can help locate the component.
- element.source: source file and optional line, column, and component; null when unavailable.
- geometry: optional before/after x, y, width, and height in viewport-relative CSS pixels.
- edits: observed CSS property changes.
- selectionGroups: optional links to related changes from one multi-selection.

Each edit contains property, observed from/to values, an optional kind (move, resize, or style), an optional move delta (x/y screen displacement in CSS pixels), and an optional note. Interpret measurements with the task notes and browser context; inspect source and implement the intent rather than copying generated CSS.

For selectionGroups, id links related changes, selectedCount counts selected elements (not change records), and role is either member or layout-container. A layout-container change describes one shared parent even when multiple members are selected. Optional notes, source details, kinds, and groups may be absent in older tasks.`
