import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TASK_SCHEMA_VERSION, VisdiffTaskPayloadSchema, type VisdiffTask, type VisdiffTaskPayload } from './types'
import { appendTask, clearPending, newTaskId, queueFile, readPending } from './queue'

export const VISDIFF_BASE = '/__visdiff'
const CLIENT_PATH = 'client.js'
const MAX_BODY = 512 * 1024
const LOCAL_PAGE_ORIGINS: Record<string, true> = {
  localhost: true,
  '127.0.0.1': true,
  '[::1]': true,
}
const LOCAL_PAGE_PROTOCOLS: Record<string, true> = {
  'http:': true,
  'https:': true,
}

/* ---------- request boundary schema ---------- */

export function parsePayload(raw: unknown): VisdiffTaskPayload | null {
  const parsed = VisdiffTaskPayloadSchema.safeParse(raw)
  if (!parsed.success) return null
  const payload = parsed.data
  return {
    ...payload,
    viewport: {
      width: Math.round(payload.viewport.width),
      height: Math.round(payload.viewport.height),
    },
  }
}

/* ---------- terminal output ---------- */

export function summarizeTask(task: VisdiffTask, root: string): string {
  const tty = process.stdout.isTTY
  const c = (s: string, code: string) => (tty ? `${code}${s}\x1b[0m` : s)
  const bold = '\x1b[1m'
  const dim = '\x1b[2m'
  const cyan = '\x1b[36m'
  const lines = [c(`▲ visdiff · task ${task.id} · ${task.changes.length} element(s)`, cyan)]
  if (task.note !== undefined && task.note.length > 0) {
    lines.push(`  note: ${task.note}`)
  }
  for (const change of task.changes) {
    const src = change.element.source
    const loc = src ? `${src.file}${src.line != null ? `:${src.line}` : ''}` : change.element.selector
    const column = src?.line != null && src.column != null ? c(`:${src.column}`, dim) : ''
    const component = src?.component ? c(`  (${src.component})`, dim) : ''
    lines.push(`  ${c(loc, bold)}${column}${component}`)
    for (const edit of change.edits) {
      const to = edit.to.length <= 48 ? edit.to : `${edit.to.slice(0, 47)}…`
      lines.push(`    ${edit.property}: ${c(edit.from, dim)} → ${to}`)
    }
  }
  lines.push(c(`  queue → ${queueFile(root)}`, dim))
  return lines.join('\n')
}

/* ---------- client bundle serving ---------- */

const distDir = path.dirname(fileURLToPath(import.meta.url))

let clientWarned = false

async function loadClient(): Promise<string> {
  try {
    return await readFile(path.join(distDir, CLIENT_PATH), 'utf8')
  } catch {
    if (!clientWarned) {
      clientWarned = true
      console.error('[visdiff] dist/client.js missing — rebuild the package ("npm run build" in packages/visdiff)')
    }
    return `console.error('[visdiff] overlay script missing: rebuild the visdiff package')`
  }
}

/* ---------- shared request handler (used by vite middleware and standalone server) ---------- */

export type VisdiffRequestHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>

export interface CreateHandlerOptions {
  root: string
  /** standalone server talks to arbitrary page origins; vite middleware is same-origin */
  cors?: boolean
}

export function createVisdiffHandler(options: CreateHandlerOptions): VisdiffRequestHandler {
  return async (req, res) => {
    const u = new URL(req.url ?? '/', 'http://localhost')
    let p = u.pathname
    if (p.startsWith(VISDIFF_BASE)) p = p.slice(VISDIFF_BASE.length) || '/'
    if (p === '/') return false

    if (req.method === 'GET' && p === `/client.js`) {
      const body = await loadClient()
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' })
      res.end(body)
      return true
    }

    if (options.cors) {
      const origin = req.headers.origin
      if (origin !== undefined) {
        let parsedOrigin: URL
        try {
          parsedOrigin = new URL(origin)
        } catch {
          res.writeHead(403)
          res.end()
          return true
        }
        if (LOCAL_PAGE_ORIGINS[parsedOrigin.hostname] !== true || LOCAL_PAGE_PROTOCOLS[parsedOrigin.protocol] !== true) {
          res.writeHead(403)
          res.end()
          return true
        }
        res.setHeader('access-control-allow-origin', origin)
        res.setHeader('vary', 'Origin')
      }
      res.setHeader('access-control-allow-methods', 'POST, GET, OPTIONS')
      res.setHeader('access-control-allow-headers', 'content-type')
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return true
    }

    if (req.method === 'POST' && p === '/save') {
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of req) {
        size += (chunk as Buffer).length
        if (size > MAX_BODY) {
          res.writeHead(413, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ error: 'payload too large' }))
          return true
        }
        chunks.push(chunk as Buffer)
      }
      let rawPayload: unknown
      try {
        rawPayload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'invalid task payload' }))
        return true
      }
      const payload = parsePayload(rawPayload)
      if (payload === null) {
        res.writeHead(400, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'invalid task payload' }))
        return true
      }
      const task: VisdiffTask = { ...payload, schemaVersion: TASK_SCHEMA_VERSION, id: newTaskId(), receivedAt: new Date().toISOString() }
      await appendTask(options.root, task)
      console.log(summarizeTask(task, options.root))
      res.writeHead(201, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ id: task.id, file: queueFile(options.root) }))
      return true
    }

    if (req.method === 'GET' && p === '/pending') {
      const tasks = await readPending(options.root)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(tasks, null, 2))
      return true
    }

    if (req.method === 'POST' && p === '/clear') {
      const cleared = await clearPending(options.root)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ cleared }))
      return true
    }

    return false
  }
}

/* ---------- standalone endpoint server (non-vite bundlers / manual setups) ---------- */

export interface StandaloneServer {
  port: number
  url: string
  close(): void
}

export interface StandaloneServerOptions {
  root: string
  port: number
}

export async function startStandaloneServer(options: StandaloneServerOptions): Promise<StandaloneServer> {
  const handler = createVisdiffHandler({ root: options.root, cors: true })
  const firstPort = options.port
  const maxPort = firstPort + 20

  for (let port = firstPort; port <= maxPort; port++) {
    const server = createServer((req, res) => {
      handler(req, res)
        .then((handled) => {
          if (!handled) {
            res.writeHead(404)
            res.end()
          }
        })
        .catch((err) => {
          console.error('[visdiff] request failed', err)
          res.writeHead(500)
          res.end()
        })
    })
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve)
        server.once('error', reject)
        server.listen(port, '127.0.0.1')
      })
      const url = `http://127.0.0.1:${port}${VISDIFF_BASE}`
      console.log(`[visdiff] endpoint ${url}`)
      console.log(`[visdiff] inject <script defer src="${url}/client.js"></script> into your dev page, then make edits and press "✔ Generate task"`)
      return {
        port,
        url,
        close: () => server.close(),
      }
    } catch (err) {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      const code = typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string' ? err.code : ''
      if (code !== 'EADDRINUSE' || port === maxPort) throw err
    }
  }
  throw new Error(`[visdiff] no free port in ${firstPort}..${maxPort}`)
}
