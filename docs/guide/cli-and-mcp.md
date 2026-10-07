# CLI and MCP

Both interfaces operate on `.visdiff/tasks.json` in the current project.

## CLI

Run from the project root:

```bash
npx -y visdiff tasks
npx -y visdiff instructions
npx -y visdiff clear <task-id> [task-id ...]
```

| Command | Purpose |
|---|---|
| `tasks` | Print all pending task JSON. |
| `instructions` | Print setup guidance, the agent workflow, and the task-field reading guide. |
| `clear <task-id...>` | Remove only the listed task IDs. |

Bare `clear` removes the entire queue. Use it only when that is intended.

## MCP

Register the stdio server with Claude Code:

```bash
claude mcp add visdiff -- npx -y visdiff mcp
```

| Tool | Purpose |
|---|---|
| `visdiff_pending_tasks` | Return queued tasks and point agents to the workflow and task-format resources. |
| `visdiff_clear_tasks` | Remove the supplied task IDs. |

The server also exposes these read-only resources:

| Resource URI | Purpose |
|---|---|
| `visdiff://agent-workflow` | Project setup, task handling, verification, and queue-clearing workflow. |
| `visdiff://task-format` | Task fields and guidance for interpreting captured browser changes. |

The server uses local stdio, not HTTP. Other MCP clients can run `npx -y visdiff mcp` with their own configuration syntax.

## Queue safety

Clear only IDs whose changes were implemented and verified. Clearing task `A` by ID preserves a later task `B`; never clear the whole queue during partial processing.
