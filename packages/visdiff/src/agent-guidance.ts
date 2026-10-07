export const AGENT_WORKFLOW = `Visdiff agent workflow

First-time project setup (do this once per project):
1. Inspect the project root, package scripts, framework, bundler, and existing configuration before changing anything.
2. If Visdiff is already integrated, do not add a duplicate plugin. Otherwise, for a Vite project using React, Vue 3, or Svelte, add the Visdiff Vite plugin to the existing Vite config before the framework plugin. Add the package dependency only if the project does not already have it.
3. Do not edit components or templates to add markers. Visdiff adds development-only source anchors automatically for supported Vite frameworks. Keep the integration out of production builds.
4. If the project uses another bundler or framework, do not claim equivalent source-anchor support. Use only an existing documented adapter, explain any manual client-script step, and report that source locations may be unavailable. Ask before introducing a custom compiler integration.
5. Tell the user what one-time config/dependency change was made and how to start or restart the development server. The user opens the running app, makes a visual edit, and applies it; do not invent a task if the queue is empty.

For each visual task:
1. Read the complete task, including task.note and per-edit notes. Treat notes as user intent and CSS from/to values as observed browser results, not implementation instructions.
2. Group related changes by selectionGroups.id. A "member" is a selected element; "layout-container" is its shared parent. selectedCount is the number of selected elements, not the number of task changes; a layout-container entry represents one change to their shared parent. Apply related changes together when appropriate.
3. Inspect element.source and nearby component/styles. Use selector, text, URL, and viewport as runtime context; do not paste selectors or generated CSS blindly into source.
4. Make the smallest maintainable source change that achieves the requested result. Preserve responsive behavior and unrelated styling. If the note, captured viewport, and CSS delta leave responsive scope unclear, ask before choosing between a breakpoint-specific and global change.
5. Run the relevant checks and verify the result in the application at the task viewport when possible. If a task is ambiguous or cannot be verified, leave it pending and report the limitation.
6. Remove only task IDs whose changes were implemented and verified. With the CLI, use "visdiff clear <task-id> [task-id ...]"; never use bare "visdiff clear" for partial completion. With MCP, pass only those IDs to visdiff_clear_tasks.`
