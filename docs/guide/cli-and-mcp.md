# CLI and MCP

Both interfaces read and update the same project queue at `.visdiff/pending.json`. The CLI is convenient for terminal-based agents; MCP makes the same operations available as agent tools. The first-time project setup and repeatable task loop are described in the [agent workflow](/guide/agent-workflow).

## CLI

Install `visdiff` in the project or run it on demand with `npx`:

```bash
npx -y visdiff tasks
npx -y visdiff instructions
npx -y visdiff clear <task-id> [task-id ...]
```

- `tasks` prints the full queued JSON.
- `instructions` prints setup guidance and the recommended task workflow for the agent.
- `clear <task-id...>` removes only the listed task IDs.
- `clear` with no IDs clears the entire queue; use it only when that is intended.

## MCP

Register the stdio server with Claude Code:

```bash
claude mcp add visdiff -- npx -y visdiff mcp
```

The server exposes two tools:

- **`visdiff_pending_tasks`** — returns pending tasks and first-time setup/task workflow guidance.
- **`visdiff_clear_tasks`** — removes only task IDs supplied by the agent.

The server communicates over local stdio; it is not an HTTP API. Other MCP clients can launch `npx -y visdiff mcp`, using their own configuration syntax.

## Queue safety

If an agent read task `A` and a user later creates task `B`, clearing `A` by ID preserves `B`. Avoid whole-queue clearing during partial processing. If implementation or verification is incomplete, do not clear that task.
