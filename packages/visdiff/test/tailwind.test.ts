import assert from 'node:assert/strict'
import test from 'node:test'
import { annotateTasks, suggestTailwind } from '../src/tailwind.ts'
import { VisdiffTaskQueueSchema, type VisdiffEdit } from '../src/types.ts'

const edit = (property: string, to: string, from = ''): VisdiffEdit => ({ property, from, to, kind: 'style' })

void test('layout keywords map to exact utilities', () => {
  assert.deepEqual(suggestTailwind(edit('display', 'flex')), { suggestion: 'flex', exact: true })
  assert.equal(suggestTailwind(edit('flex-direction', 'column'))?.suggestion, 'flex-col')
  assert.equal(suggestTailwind(edit('justify-content', 'space-between'))?.suggestion, 'justify-between')
  assert.equal(suggestTailwind(edit('align-items', 'center'))?.suggestion, 'items-center')
  assert.equal(suggestTailwind(edit('align-items', 'start'))?.exact, false)
  assert.equal(suggestTailwind(edit('align-items', 'left')), null)
})

void test('gap and size use the spacing scale', () => {
  assert.deepEqual(suggestTailwind(edit('gap', '16px')), { suggestion: 'gap-4', exact: true })
  assert.equal(suggestTailwind(edit('gap', '0px'))?.suggestion, 'gap-0')
  assert.equal(suggestTailwind(edit('gap', '8px 16px'))?.suggestion, 'gap-y-2 gap-x-4')
  assert.deepEqual(suggestTailwind(edit('width', '80px')), { suggestion: 'w-20', exact: true })
  assert.equal(suggestTailwind(edit('height', '1px'))?.suggestion, 'h-px')
  assert.equal(suggestTailwind(edit('width', '100%'))?.suggestion, 'w-full')
})

void test('off-scale sizes round for v3 and stay exact for v4 multiples of 4', () => {
  assert.deepEqual(suggestTailwind(edit('width', '123px')), { suggestion: 'w-32', exact: false, alternative: 'w-[123px]' })
  assert.deepEqual(suggestTailwind(edit('width', '124px')), { suggestion: 'w-32', exact: false, alternative: 'w-[124px]' })
  assert.deepEqual(suggestTailwind(edit('width', '124px'), [], { v4: true }), { suggestion: 'w-31', exact: true })
  assert.equal(suggestTailwind(edit('width', '123px'), [], { v4: true })?.exact, false)
})

void test('existing classes of the same group are reported as replaced', () => {
  const hint = suggestTailwind(edit('width', '80px'), ['w-10', 'md:w-20', 'min-w-0', 'flex'])
  assert.deepEqual(hint?.replaces, ['w-10'])
  assert.equal(suggestTailwind(edit('display', 'flex'), ['flex', 'p-2'])?.replaces, undefined)
  assert.deepEqual(suggestTailwind(edit('display', 'grid'), ['flex'])?.replaces, ['flex'])
})

void test('grid columns and move edits', () => {
  assert.equal(suggestTailwind(edit('grid-template-columns', '100px 100px 100px'))?.suggestion, 'grid-cols-3')
  assert.equal(suggestTailwind(edit('grid-template-columns', '100px 1fr'))?.suggestion, 'grid-cols-[100px_1fr]')
  assert.equal(suggestTailwind({ ...edit('transform', 'translate(4px, 0px)'), kind: 'move' }), null)
})

void test('annotateTasks adds hints without mutating input', () => {
  const tasks = VisdiffTaskQueueSchema.parse([{
    id: 'a',
    receivedAt: '2026-10-07T16:00:00.000Z',
    url: 'u',
    viewport: { width: 1, height: 1 },
    changes: [{
      element: { tag: 'div', selector: 'div', classes: ['w-10'] },
      edits: [{ property: 'width', from: '40px', to: '80px', kind: 'resize' }, { property: 'transform', from: 'none', to: 'translate(1px, 1px)', kind: 'move' }],
    }],
  }])
  const [out] = annotateTasks(tasks)
  const edits = out?.changes[0]?.edits
  assert.deepEqual(edits?.[0]?.tailwind, { suggestion: 'w-20', exact: true, replaces: ['w-10'] })
  assert.equal(edits?.[1]?.tailwind, undefined)
  assert.equal('tailwind' in (tasks[0]?.changes[0]?.edits[0] ?? {}), false)
})
