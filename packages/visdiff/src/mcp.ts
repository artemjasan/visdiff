import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { queueFile, readPending, removePending } from './queue'
import type { VisdiffTask } from './types'

function textContent(body: unknown): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }] }
}

export async function runMcpServer(root: string): Promise<void> {
  const server = new McpServer({ name: 'visdiff', version: '0.1.0' })

  server.tool(
    'visdiff_pending_tasks',
    'List pending visual-edit batches captured with the visdiff browser overlay. '
      + 'Each task contains one or more elements; every element entry has a source anchor and its CSS from/to edits. '
      + 'Apply a batch, then call visdiff_clear_tasks with its task ID.',
    {},
    async () => {
      const tasks: VisdiffTask[] = await readPending(root)
      if (tasks.length === 0) return textContent({ message: 'No pending visual tasks.' })
      return textContent({ queueFile: queueFile(root), tasks })
    },
  )

  server.tool(
    'visdiff_clear_tasks',
    'Remove only the listed pending task IDs after those visual edits have been applied to the codebase. '
      + 'Tasks created after the agent read the queue remain pending.',
    { ids: z.array(z.string().min(1)).min(1) },
    async ({ ids }) => {
      const cleared = await removePending(root, ids)
      return textContent({ cleared })
    },
  )

  await server.connect(new StdioServerTransport())
}
