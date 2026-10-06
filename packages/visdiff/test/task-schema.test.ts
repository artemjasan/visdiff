import assert from 'node:assert/strict'
import test from 'node:test'
import { VisdiffTaskPayloadSchema } from '../src/types.ts'
import { composeMoveTransform } from '../src/client.ts'

const sampleTask = {
  url: 'https://example.com',
  viewport: { width: 1200, height: 800 },
  changes: [
    {
      element: {
        tag: 'div',
        selector: '#app > div:nth-of-type(1)',
        text: 'Hello',
        source: null,
      },
      edits: [
        { property: 'width', from: '100px', to: '120px', kind: 'resize' },
      ],
    },
  ],
}

test('note is trimmed and omitted when blank', () => {
  const withNote = VisdiffTaskPayloadSchema.parse({ ...sampleTask, note: '   Keep it brief  ' })
  assert.equal(withNote.note, 'Keep it brief')

  const withoutNote = VisdiffTaskPayloadSchema.parse({ ...sampleTask, note: '   ' })
  assert.equal(withoutNote.note, undefined)
})

test('drag transform composes from the original baseline instead of accumulating prior transforms', () => {
  assert.equal(composeMoveTransform('rotate(15deg)', 12, -4), 'translate(12px, -4px) rotate(15deg)')
  assert.equal(composeMoveTransform('none', 8, 6), 'translate(8px, 6px)')
})
