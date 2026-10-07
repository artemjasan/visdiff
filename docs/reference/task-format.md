# Task format

The browser submits a batch to the local development endpoint. The endpoint validates it, adds `id` and `receivedAt`, and appends it to `.visdiff/tasks.json`. CLI and MCP return the queued task to the agent.

## Task fields

| Field | Meaning |
|---|---|
| `schemaVersion` | Task format version (currently `1`); absent in older tasks, which are read as version 1. |
| `id` | Queue identifier used to clear this task. |
| `receivedAt` | ISO timestamp when the endpoint accepted it. |
| `url` | Page URL where the edit was captured. |
| `viewport` | Browser width and height in CSS pixels. |
| `note` | Optional task-wide intent or constraint. |
| `changes` | Changed rendered elements and their edits. |

## Element changes

Each item in `changes` contains:

| Field | Meaning |
|---|---|
| `element.tag` | Rendered DOM tag. |
| `element.selector` | Runtime selector for locating the element. |
| `element.text` | Short rendered text context. |
| `element.classes` | Optional class tokens on the rendered element (up to 64). |
| `element.source` | File, line, column, and optional component; `null` when unavailable. |
| `edits` | CSS properties with observed `from`, `to`, `kind`, and optional note. |
| `selectionGroups` | Optional links between related multi-selection changes. |

Edit kinds are `move`, `resize`, and `style`. Layout controls create `style` edits on the shared parent.

## Selection groups

- `id` links changes from one selection operation.
- `selectedCount` is the number of selected elements, not change records.
- `role: "member"` identifies a selected element.
- `role: "layout-container"` identifies one change to the common parent. Member entries may be absent if no direct member edits were made.

Notes, source details, and selection groups are optional for compatibility with older tasks. See the [agent workflow](/guide/agent-workflow) for implementation rules.

## Tailwind hints

In projects that use Tailwind CSS (detected from `package.json` or `tailwind.config.*`), `visdiff tasks` and the `visdiff_pending_tasks` MCP tool add an optional `tailwind` object to edits they can map. It is computed when tasks are read and is not stored in the queue.

| Field | Meaning |
|---|---|
| `suggestion` | Utility class(es) for the edit's `to` value, for example `gap-4` or `w-20`. |
| `exact` | `false` when the value was rounded to the nearest default scale step. |
| `alternative` | Arbitrary-value class (for example `w-[123px]`) when `exact` is `false`. |
| `replaces` | Existing unprefixed classes on the element that the suggestion should replace. |
| `breakpoint` | Largest breakpoint at or below the task's viewport width (for example `md`); absent below the smallest. |
| `responsive` | The suggestion limited to that breakpoint and up (for example `md:gap-4`). Tailwind is mobile-first, so use it only when the change should not apply to smaller screens. |
| `replacesAtBreakpoint` | Existing classes already prefixed with that breakpoint that `responsive` would replace. |

Hints cover layout controls, `gap`, `width`, `height` and grid columns; `move` edits get none. They use Tailwind's default spacing scale (v4 also accepts any multiple of the `--spacing` unit) and the project's theme when it can be read:

- **v3:** static `theme.spacing`, `theme.width`, `theme.height`, `theme.screens` and their `extend` values from a JavaScript `tailwind.config.*` (`px` and `rem` only). TypeScript configs load only on Node versions that can import `.ts`; computed (function) values are ignored. Visdiff imports the config file to read it.
- **v4:** `--spacing`, `--spacing-*`, `--width-*`, `--height-*` and `--breakpoint-*` from `@theme` blocks in the project's CSS files (up to four directories deep, excluding `node_modules`).

Verify hints against the project's theme; unreadable configs fall back to the defaults.
