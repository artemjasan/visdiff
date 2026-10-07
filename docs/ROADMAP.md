# Roadmap

Visdiff is early (0.1). This roadmap describes where the project is heading and in what order.

## Current state

**What works today**

- Vite overlay for select, move, resize, multi-select and Flex/Grid layout edits.
- Source anchors for React, Vue and Svelte.
- Task queue in `.visdiff/tasks.json`, read through the CLI or MCP.
- VitePress documentation and three example apps.

**Strengths**

- It does not patch code. The agent chooses the implementation, which keeps results maintainable.
- It is agent-agnostic through the CLI and MCP.
- The task format is small and clearly specified.

**Gaps**

- Tasks carry geometry and style edits only; there are no screenshots.
- There is no before/after verification.
- Tailwind and CSS-in-JS projects get no styling-system hints.
- Vite is the only integrated adapter; Turbopack is unsupported.
- The workflow is local and single-user.
- Information flows one way: the agent cannot report status back to the browser.
- Editing is limited to layout; there are no text, colour, spacing or responsive edits.
- Test coverage is thin, with none for the client.

## Phase 1: Foundation (0.2)

- Test client logic (geometry, batch, layout) and add a Playwright smoke test against the examples.
- Add a task schema version and a migration path.
- Add a `visdiff status` command.
- Write contributing and architecture docs.
- Add a changelog and a release process.

## Phase 2: Visual feedback (0.3)

- Screenshots in tasks (full viewport and element crop).
- Task status flow: pending → in progress → done or failed, visible in the overlay.
- `visdiff verify` with a pixel-diff report, also exposed as an MCP tool.

## Phase 3: Smarter context (0.4)

- Detect Tailwind and CSS Modules; include computed-style and design-token hints.
- Text, colour, spacing and radius editing.
- Breakpoint-aware tasks, so agents can write media queries instead of global styles.

## Phase 4: Reach (0.5)

- First-class adapters for webpack, Rsbuild and Next.js (non-Turbopack).
- Adapters for Solid and Astro.
- A browser extension that works without installing the plugin.

## Phase 5: Collaboration (1.0)

- Annotations and comments on elements.
- Shareable task bundles for teammates and reviewers.
- Stable task schema and public API.
- CI mode that runs visual verification on pull requests.

## Feature ideas

- **Visual proof loop:** capture before and after, then diff against the intended preview.
- **Design-system mapping:** snap edits to spacing and colour tokens and flag one-off values.
- **Agent-to-browser feedback:** show task status and agent notes in the overlay.

## Priorities

Phase 1 and the screenshot half of Phase 2 come first. The verification loop is what makes this project *visdiff* and lets an agent check its own work.
