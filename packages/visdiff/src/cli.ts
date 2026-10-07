import { runMcpServer } from './mcp'
import { startStandaloneServer } from './server-core'
import { clearPending, readPending, removePending } from './queue'
import { AGENT_WORKFLOW } from './agent-guidance'
import { formatStatus } from './status'
import { detectStylingHint, withStylingHints } from './styling'

const USAGE = `visdiff — browser visual edits → JSON tasks for coding agents

Usage: visdiff <command>

  mcp            Run the MCP stdio server (tools: visdiff_pending_tasks, visdiff_clear_tasks)
  tasks          Print visual tasks (.visdiff/tasks.json)
  status         Show a one-line summary of each pending task
  instructions   Print the recommended coding-agent workflow
  clear [ids...] Remove only the listed task IDs; with no IDs (or --all), clear the entire queue
  serve [opts]   Start a standalone endpoint server (default port 9090) for non-plugin dev setups
  help           Show this help

From this repository checkout, use:
  npm exec --workspace examples/vite-react -- visdiff tasks
  npm exec --workspace examples/vite-react -- visdiff instructions
  npm exec --workspace examples/vite-react -- visdiff mcp
`

function parsePortFlag(argv: string[]): number {
  let port = 9090
  for (const arg of argv) {
    if (arg.startsWith('--port=')) {
      const parsed = Number.parseInt(arg.slice('--port='.length), 10)
      if (Number.isFinite(parsed) && parsed > 0) port = parsed
    }
  }
  return port
}

async function printTasks(): Promise<void> {
  const tasks = await readPending(process.cwd())
  if (tasks.length === 0) {
    console.log('No pending visual tasks.')
    return
  }
  console.log(JSON.stringify(await withStylingHints(process.cwd(), tasks), null, 2))
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const cmd = argv[0]
  if (cmd === undefined || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(USAGE)
    return
  }
  switch (cmd) {
    case 'mcp':
      await runMcpServer(process.cwd())
      return
    case 'tasks':
      await printTasks()
      return
    case 'status':
      console.log(formatStatus(await readPending(process.cwd())))
      return
    case 'instructions': {
      const hint = await detectStylingHint(process.cwd())
      console.log(hint === '' ? AGENT_WORKFLOW : `${AGENT_WORKFLOW}\n\n${hint}`)
      return
    }
    case 'clear': {
      const args = argv.slice(1)
      const all = args.includes('--all')
      const ids = args.filter((arg) => arg !== '--all').map((id) => id.trim())
      if (all && ids.length > 0) {
        throw new Error('Use either --all or task IDs, not both.')
      }
      if (ids.some((id) => id.length === 0)) {
        throw new Error('Task IDs must not be empty.')
      }
      const cleared = !all && ids.length > 0
        ? await removePending(process.cwd(), ids)
        : await clearPending(process.cwd())
      console.log(`[visdiff] cleared ${cleared} pending task(s)`)
      return
    }
    case 'serve': {
      await startStandaloneServer({ root: process.cwd(), port: parsePortFlag(argv.slice(1)) })
      console.log('[visdiff] Ctrl-C to stop')
      return
    }
    default:
      console.error(`[visdiff] unknown command: ${cmd}`)
      console.log(USAGE)
      process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(String(err))
  process.exitCode = 1
})
