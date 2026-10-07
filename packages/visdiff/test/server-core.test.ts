import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createVisdiffHandler } from '../src/server-core.ts'

const validPayload = {
  url: 'http://localhost:5173/',
  viewport: { width: 800.4, height: 600.6 },
  note: '  preserve spacing  ',
  changes: [{
    element: {
      tag: 'button',
      selector: 'main > button:nth-of-type(1)',
      text: 'Save',
      source: { file: 'src/App.tsx', line: 12 },
      classes: ['button', 'primary'],
    },
    edits: [{ property: 'width', from: '80px', to: '120px', kind: 'resize' }],
  }],
}

void test('HTTP endpoint validates, stores, reads, and clears tasks', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'visdiff-http-test-'))
  const handler = createVisdiffHandler({ root, cors: true })
  const server = createServer((req, res) => {
    void handler(req, res).then((handled) => {
      if (!handled) {
        res.writeHead(404)
        res.end()
      }
    }).catch((error: unknown) => {
      res.writeHead(500)
      res.end(String(error))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${address.port}/__visdiff`

  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    await rm(root, { recursive: true, force: true })
  })

  await t.test('accepts a valid task and normalizes it in the queue', async () => {
    const response = await fetch(`${baseUrl}/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload),
    })
    assert.equal(response.status, 201)
    const receipt: unknown = await response.json()
    assert.equal(typeof receipt, 'object')
    assert.notEqual(receipt, null)
    const id = (receipt as { id: string }).id
    assert.match(id, /^vdt_/)

    const pending = await fetch(`${baseUrl}/pending`)
    assert.equal(pending.status, 200)
    const [task] = await pending.json() as Array<{
      id: string
      schemaVersion: number
      receivedAt: string
      note: string
      viewport: { width: number; height: number }
      changes: Array<{ element: { classes?: string[] }; edits: Array<{ property: string }> }>
    }>
    assert.equal(task?.id, id)
    assert.equal(task?.schemaVersion, 1)
    assert.equal(task?.note, 'preserve spacing')
    assert.deepEqual(task?.viewport, { width: 800, height: 601 })
    assert.deepEqual(task?.changes[0]?.element.classes, ['button', 'primary'])
    assert.equal(task?.changes[0]?.edits[0]?.property, 'width')
    assert.ok(Number.isFinite(Date.parse(task?.receivedAt ?? '')))

    const queue = JSON.parse(await readFile(path.join(root, '.visdiff', 'tasks.json'), 'utf8')) as unknown[]
    assert.equal(queue.length, 1)
  })

  await t.test('rejects malformed JSON and invalid task payloads', async () => {
    const malformed = await fetch(`${baseUrl}/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })
    assert.equal(malformed.status, 400)

    const invalid = await fetch(`${baseUrl}/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validPayload, changes: [] }),
    })
    assert.equal(invalid.status, 400)
  })

  await t.test('rejects oversized request bodies', async () => {
    const response = await fetch(`${baseUrl}/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'x'.repeat(512 * 1024 + 1),
    })
    assert.equal(response.status, 413)
    assert.deepEqual(await response.json(), { error: 'payload too large' })
  })

  await t.test('restricts CORS to local HTTP(S) pages', async () => {
    const local = await fetch(`${baseUrl}/pending`, { headers: { origin: 'http://localhost:5173' } })
    assert.equal(local.status, 200)
    assert.equal(local.headers.get('access-control-allow-origin'), 'http://localhost:5173')

    const preflight = await fetch(`${baseUrl}/save`, {
      method: 'OPTIONS',
      headers: { origin: 'https://example.com' },
    })
    assert.equal(preflight.status, 403)

    const remote = await fetch(`${baseUrl}/pending`, { headers: { origin: 'https://example.com' } })
    assert.equal(remote.status, 403)
  })

  await t.test('clears pending tasks and returns 404 for unknown routes', async () => {
    const cleared = await fetch(`${baseUrl}/clear`, { method: 'POST' })
    assert.equal(cleared.status, 200)
    assert.deepEqual(await cleared.json(), { cleared: 1 })

    const pending = await fetch(`${baseUrl}/pending`)
    assert.deepEqual(await pending.json(), [])

    const missing = await fetch(`${baseUrl}/unknown`)
    assert.equal(missing.status, 404)
  })
})
