import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { formatStatus } from '../src/status.ts'
import { detectStylingHint } from '../src/styling.ts'
import { VisdiffTaskQueueSchema } from '../src/types.ts'

void test('formatStatus summarizes tasks', () => {
  assert.equal(formatStatus([]), 'No pending visual tasks.')
  const tasks = VisdiffTaskQueueSchema.parse([{
    id: 'a',
    receivedAt: '2026-10-07T16:00:00.000Z',
    url: 'http://localhost/',
    viewport: { width: 100, height: 50 },
    note: 'hi',
    changes: [{ element: { tag: 'div', selector: 'div' }, edits: [{ property: 'width', from: '1px', to: '2px' }] }],
  }])
  const out = formatStatus(tasks)
  assert.match(out, /1 pending visual task\(s\)/)
  assert.match(out, /a {2}1 element\(s\), 1 edit\(s\) {2}100×50 {2}http:\/\/localhost\/ — hi/)
})

void test('legacy tasks without schemaVersion parse as version 1', () => {
  const [task] = VisdiffTaskQueueSchema.parse([{
    id: 'a',
    receivedAt: '2026-10-07T16:00:00.000Z',
    url: 'u',
    viewport: { width: 1, height: 1 },
    changes: [{ element: { tag: 'div', selector: 'div' }, edits: [{ property: 'width', from: '1px' }] }],
  }])
  assert.equal(task?.schemaVersion, 1)
})

void test('detectStylingHint finds Tailwind by dependency or config', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'visdiff-style-'))
  try {
    assert.equal(await detectStylingHint(root), '')
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ devDependencies: { tailwindcss: '^4' } }))
    assert.match(await detectStylingHint(root), /Tailwind/)
    await writeFile(path.join(root, 'package.json'), '{}')
    assert.equal(await detectStylingHint(root), '')
    await writeFile(path.join(root, 'tailwind.config.ts'), '')
    assert.match(await detectStylingHint(root), /Tailwind/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
