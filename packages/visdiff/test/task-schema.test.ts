import assert from 'node:assert/strict'
import test from 'node:test'
import { VisdiffTaskPayloadSchema } from '../src/types.ts'
import { composeMoveTransform, currentEditList, sameElement } from '../src/client/model.ts'

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

test('current edits are copied in stable property order', () => {
  const edits = {
    height: { property: 'height', from: '20px', to: '30px', kind: 'resize' as const },
    transform: { property: 'transform', from: 'none', to: 'translate(4px, 0px)', kind: 'move' as const },
    display: { property: 'display', from: 'block', to: 'flex', kind: 'style' as const },
    'justify-content': { property: 'justify-content', from: 'normal', to: 'center', kind: 'style' as const },
  }
  assert.deepEqual(currentEditList(edits), [
    { property: 'transform', from: 'none', to: 'translate(4px, 0px)', kind: 'move' },
    { property: 'height', from: '20px', to: '30px', kind: 'resize' },
    { property: 'display', from: 'block', to: 'flex', kind: 'style' },
    { property: 'justify-content', from: 'normal', to: 'center', kind: 'style' },
  ])
})

test('layout CSS edits are valid task edits', () => {
  const task = VisdiffTaskPayloadSchema.parse({
    ...sampleTask,
    changes: [{
      ...sampleTask.changes[0],
      edits: [
        { property: 'display', from: 'block', to: 'flex', kind: 'style' },
        { property: 'justify-content', from: 'normal', to: 'space-between', kind: 'style' },
      ],
    }],
  })
  assert.deepEqual(task.changes[0]?.edits.map((edit) => edit.property), ['display', 'justify-content'])
})

test('staged changes match by selector and source anchor', () => {
  const element = {
    tag: 'button',
    selector: '#save',
    text: 'Save',
    source: { file: 'src/App.tsx', line: 12, column: 4 },
  }
  assert.equal(sameElement(element, { ...element, text: 'Save now' }), true)
  assert.equal(sameElement(element, { ...element, selector: '#cancel' }), false)
  assert.equal(sameElement(element, { ...element, source: { ...element.source, line: 13 } }), false)
})
