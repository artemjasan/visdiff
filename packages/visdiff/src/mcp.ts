import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { queueFile, readPending, removePending } from './queue'
import type { VisdiffTask } from './types'
import { AGENT_WORKFLOW } from './agent-guidance'

function textContent(body: unknown): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }] }
}

export async function runMcpServer(root: string): Promise<void> {
  const server = new McpServer({ name: 'visdiff', version: '0.1.0' })

  server.registerTool(
    'visdiff_pending_tasks',
    {
      title: 'List pending visual tasks',
      description: `Read pending visual tasks from the project queue.\n\n${AGENT_WORKFLOW}`,
      inputSchema: {},
    },
    async () => {
      const tasks: VisdiffTask[] = await readPending(root)
      if (tasks.length === 0) return textContent({ message: 'No pending visual tasks.' })
      return textContent({ queueFile: queueFile(root), tasks })
    },
  )

  server.registerTool(
    'visdiff_clear_tasks',
    {
      title: 'Clear applied visual tasks',
      description: 'Remove only listed task IDs whose changes have been implemented and verified. '
        + 'Do not clear unapplied tasks; tasks not listed remain pending.',
      inputSchema: { ids: z.array(z.string().min(1)).min(1) },
    },
    async ({ ids }) => {
      const cleared = await removePending(root, ids)
      return textContent({ cleared })
    },
  )

  await server.connect(new StdioServerTransport())
}
