import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { appendTask, readPending, removePending } from '../src/queue.ts'
import type { VisdiffTask } from '../src/types.ts'

function task(id: string): VisdiffTask {
  return {
    id,
    receivedAt: '2026-10-07T16:00:00.000Z',
    note: undefined,
    url: 'https://example.com',
    viewport: { width: 1200, height: 800 },
    changes: [{
      element: { tag: 'button', selector: '#save', text: 'Save', source: null },
      edits: [{ property: 'width', from: '100px', to: '120px', kind: 'resize' }],
    }],
  }
}

void test('removing applied task IDs preserves later tasks and ignores unknown IDs', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'visdiff-queue-test-'))
  t.after(async () => rm(root, { recursive: true, force: true }))

  await appendTask(root, task('applied'))
  const agentSnapshot = await readPending(root)
  await appendTask(root, task('created-later'))

  assert.equal(await removePending(root, [...agentSnapshot.map(({ id }) => id), 'unknown']), 1)
  assert.deepEqual((await readPending(root)).map(({ id }) => id), ['created-later'])
})
