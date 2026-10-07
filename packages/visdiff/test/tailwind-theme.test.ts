import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { activeBreakpoint, suggestTailwind } from '../src/tailwind.ts'
import { loadTailwindTheme, themeFromV3Config, themeFromV4Css, toPx } from '../src/tailwind-theme.ts'
import { annotateProjectTasks, detectTailwind } from '../src/styling.ts'
import type { VisdiffEdit, VisdiffTask } from '../src/types.ts'

const edit = (property: string, to: string): VisdiffEdit => ({ property, from: '', to, kind: 'resize' })

void test('toPx converts px and rem only', () => {
  assert.equal(toPx('1.5rem'), 24)
  assert.equal(toPx('12px'), 12)
  assert.equal(toPx(8), 8)
  assert.equal(toPx('calc(1rem + 2px)'), null)
})

void test('v3 theme: extend adds tokens, spacing override replaces defaults', () => {
  const extended = themeFromV3Config({ theme: { extend: { spacing: { gutter: '30px', '18': '4.5rem' } } } })
  assert.deepEqual(suggestTailwind(edit('gap', '30px'), [], { theme: extended }), { suggestion: 'gap-gutter', exact: true })
  assert.equal(suggestTailwind(edit('gap', '16px'), [], { theme: extended })?.suggestion, 'gap-4')
  const replaced = themeFromV3Config({ theme: { spacing: { sm: '8px', md: '16px' } } })
  assert.deepEqual(suggestTailwind(edit('gap', '16px'), [], { theme: replaced }), { suggestion: 'gap-md', exact: true })
  assert.deepEqual(suggestTailwind(edit('gap', '10px'), [], { theme: replaced }), { suggestion: 'gap-sm', exact: false, alternative: 'gap-[10px]' })
})

void test('v3 width extension applies to width only', () => {
  const theme = themeFromV3Config({ theme: { extend: { width: { sidebar: '280px' } } } })
  assert.equal(suggestTailwind(edit('width', '280px'), [], { theme })?.suggestion, 'w-sidebar')
  assert.notEqual(suggestTailwind(edit('height', '280px'), [], { theme })?.suggestion, 'w-sidebar')
})

void test('v4 @theme: custom unit and named tokens', () => {
  const css = '@import "tailwindcss";\n@theme {\n  --spacing: 0.3rem;\n  --spacing-gutter: 30px;\n  --color-brand: red;\n}'
  const theme = themeFromV4Css([css])
  assert.equal(theme.unit, 4.8)
  assert.deepEqual(suggestTailwind(edit('gap', '30px'), [], { v4: true, theme }), { suggestion: 'gap-gutter', exact: true })
  assert.deepEqual(suggestTailwind(edit('gap', '9.6px'), [], { v4: true, theme }), { suggestion: 'gap-2', exact: true })
  assert.equal(suggestTailwind(edit('gap', '7px'), [], { v4: true, theme })?.exact, false)
})

void test('v4 spacing-* initial drops the default scale', () => {
  const theme = themeFromV4Css(['@theme { --spacing-*: initial; --spacing-tight: 6px; }'])
  assert.equal(theme.replaceDefaults, true)
  assert.equal(suggestTailwind(edit('gap', '6px'), [], { v4: true, theme })?.suggestion, 'gap-tight')
})

void test('loadTailwindTheme reads real project files', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'visdiff-theme-'))
  t.after(async () => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'src'))
  await mkdir(path.join(root, 'node_modules'))
  await writeFile(path.join(root, 'src', 'app.css'), '@theme { --spacing-card: 20px; }')
  await writeFile(path.join(root, 'node_modules', 'x.css'), '@theme { --spacing-bad: 1px; }')
  const v4 = await loadTailwindTheme(root, true)
  assert.deepEqual(v4.spacing, [['card', 20]])

  await writeFile(path.join(root, 'tailwind.config.mjs'), "export default { theme: { extend: { spacing: { rail: '14px' } } } }")
  assert.deepEqual((await loadTailwindTheme(root, false)).spacing, [['rail', 14]])

  await writeFile(path.join(root, 'tailwind.config.mjs'), 'throw new Error("boom")')
  assert.deepEqual((await loadTailwindTheme(root, false)).spacing, [])
})

void test('withStylingHints uses the project theme', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'visdiff-hints-'))
  t.after(async () => rm(root, { recursive: true, force: true }))
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ devDependencies: { tailwindcss: '^4.0.0' } }))
  await writeFile(path.join(root, 'app.css'), '@theme { --spacing-gutter: 30px; }')
  const task: VisdiffTask = {
    schemaVersion: 1, note: undefined, id: 'a', receivedAt: '2026-10-07T16:00:00.000Z', url: 'u', viewport: { width: 1, height: 1 },
    changes: [{ element: { tag: 'div', selector: 'div', text: '', source: null }, edits: [edit('gap', '30px')] }],
  }
  const [out] = annotateProjectTasks([task], await detectTailwind(root))
  const editWithHint = out?.changes[0]?.edits[0]
  assert.equal(
    editWithHint !== undefined && 'tailwind' in editWithHint
      ? editWithHint.tailwind?.suggestion
      : undefined,
    'gap-gutter',
  )
})

void test('project breakpoints come from v3 screens and v4 --breakpoint-*', () => {
  const v3 = themeFromV3Config({ theme: { extend: { screens: { tablet: '900px' } } } })
  assert.equal(activeBreakpoint(950, v3), 'tablet')
  assert.equal(activeBreakpoint(700, v3), 'sm')
  const replaced = themeFromV3Config({ theme: { screens: { phone: '480px', desk: '1200px' } } })
  assert.equal(activeBreakpoint(1300, replaced), 'desk')
  assert.equal(activeBreakpoint(300, replaced), null)
  const v4 = themeFromV4Css(['@theme { --breakpoint-3xl: 120rem; }'])
  assert.equal(activeBreakpoint(2000, v4), '3xl')
  const reset = themeFromV4Css(['@theme { --breakpoint-*: initial; --breakpoint-tab: 700px; }'])
  assert.equal(activeBreakpoint(800, reset), 'tab')
  assert.equal(activeBreakpoint(600, reset), null)
})
