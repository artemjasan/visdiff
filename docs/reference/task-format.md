# Task format

The browser submits a batch to the local development endpoint. The endpoint validates it, assigns an ID and timestamp, and appends it to `.visdiff/pending.json`. CLI and MCP return these queued tasks to the agent.

## Task fields

- `id` — unique queue identifier used for selective clearing.
- `receivedAt` — ISO date-time when the task entered the queue.
- `url` — page where the user made the visual edit.
- `viewport` — browser viewport width and height at capture time.
- `note` — optional task-wide user intent or constraint.
- `changes` — one or more changed rendered elements.

## Element change fields

Each item in `changes` contains:

- `element.tag` — rendered DOM tag.
- `element.selector` — runtime CSS selector for context.
- `element.text` — short rendered text context.
- `element.source` — source file, line, column, and component when the development adapter can resolve them; otherwise `null`.
- `edits` — one or more changed CSS properties with `from`, `to`, `kind`, and optional `note`.
- `selectionGroups` — optional links to related changes from a multi-selection. `selectedCount` counts selected elements, not change records; a `layout-container` entry is one change to the shared parent, and member entries may be absent when those elements had no direct edits.

Edit kinds are `move`, `resize`, and `style`. A layout control edit is a `style` edit on the shared parent.

## Compatibility

`selectionGroups`, notes, and source details are optional where applicable. Older tasks without selection group metadata remain valid.

For how to interpret these values and implement them, read the [agent workflow](/guide/agent-workflow).
