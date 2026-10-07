import assert from 'node:assert/strict'
import test from 'node:test'
import { composeMoveTransform, currentEditList, sameElement, type EditMap } from '../src/client/model.ts'
import { buildPrompt } from '../src/client/prompt.ts'
import type { VisdiffTaskChange, VisdiffTaskElement } from '../src/types.ts'

const element = (over: Partial<VisdiffTaskElement> = {}): VisdiffTaskElement => ({
  tag: 'div',
  selector: 'main > div',
  text: '',
  source: { file: 'src/App.tsx', line: 3, column: 5 },
  ...over,
})

void test('composeMoveTransform prepends translate and ignores "none"', () => {
  assert.equal(composeMoveTransform('none', 4, -2), 'translate(4px, -2px)')
  assert.equal(composeMoveTransform('', 1, 2), 'translate(1px, 2px)')
  assert.equal(composeMoveTransform(' rotate(5deg) ', 1, 2), 'translate(1px, 2px) rotate(5deg)')
})

void test('currentEditList follows property order and handles null', () => {
  assert.deepEqual(currentEditList(null), [])
  const edits: EditMap = {
    height: { property: 'height', from: '10px', to: '20px', kind: 'resize' },
    transform: { property: 'transform', from: 'none', to: 'translate(1px, 1px)', kind: 'move' },
  }
  assert.deepEqual(currentEditList(edits).map((edit) => edit.property), ['transform', 'height'])
})

void test('sameElement compares selector and source location', () => {
  assert.equal(sameElement(element(), element()), true)
  assert.equal(sameElement(element(), element({ selector: 'other' })), false)
  assert.equal(sameElement(element(), element({ source: { file: 'src/App.tsx', line: 4, column: 5 } })), false)
  assert.equal(sameElement(element({ source: null }), element({ source: null })), true)
  assert.equal(sameElement(element({ source: null }), element()), false)
})

void test('buildPrompt includes context, source, edits and notes', () => {
  const changes: VisdiffTaskChange[] = [{
    element: element({ tag: 'button', text: 'Save', source: { file: 'src/Btn.tsx', line: 9, column: 2, component: 'Btn' } }),
    edits: [{ property: 'width', from: '80px', to: '120px', kind: 'resize', note: 'keep aligned' }],
  }, {
    element: element({ source: null }),
    edits: [{ property: 'gap', from: '0px', to: '8px', kind: 'style' }],
  }]
  const prompt = buildPrompt(changes, { url: 'http://localhost:5173/', viewport: { width: 1200, height: 800 }, note: ' tidy ' })
  assert.match(prompt, /Page: http:\/\/localhost:5173\//)
  assert.match(prompt, /Viewport: 1200×800px/)
  assert.match(prompt, /Note: tidy/)
  assert.match(prompt, /1\. <button> src\/Btn\.tsx:9:2 \(Btn\)/)
  assert.match(prompt, /text: "Save"/)
  assert.match(prompt, /- width: 80px → 120px — keep aligned/)
  assert.match(prompt, /2\. <div> main > div/)
})
