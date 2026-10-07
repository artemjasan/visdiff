# Task format

The browser submits a batch to the local development endpoint. The endpoint validates it, adds `id` and `receivedAt`, and appends it to `.visdiff/tasks.json`. CLI and MCP return the queued task to the agent.

## Task fields

| Field | Meaning |
|---|---|
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
