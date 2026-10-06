import { runMcpServer } from './mcp'
import { startStandaloneServer } from './server-core'
import { clearPending, readPending } from './queue'

const USAGE = `visdiff — browser visual edits → JSON tasks for coding agents

Usage: visdiff <command>

  mcp            Run the MCP stdio server (tools: visdiff_pending_tasks, visdiff_clear_tasks)
  tasks          Print pending visual tasks (.visdiff/pending.json)
  clear          Clear the pending task queue
  serve [opts]   Start a standalone endpoint server (default port 9090) for non-plugin dev setups
  help           Show this help

This package is not published to npm yet. In this checkout, use:
  npm exec --workspace examples/vite-react -- visdiff tasks
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
  console.log(JSON.stringify(tasks, null, 2))
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
    case 'clear': {
      const cleared = await clearPending(process.cwd())
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
