import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compileTemplate, parse as parseVueSfc } from '@vue/compiler-sfc'
import { compile as compileSvelte } from 'svelte/compiler'
import { injectSource } from '../src/source-inject'

const projectRoot = process.cwd()

void test('React source injection retains source anchors and source maps', async () => {
  const result = await injectSource(
    'export function App() { return <button>Save</button> }',
    'src/App.tsx',
    projectRoot,
  )

  assert.ok(result)
  assert.match(result.code, /data-visdiff-src/)
  assert.ok(result.map)
})

void test('Vue source injection adds original file and line anchors to template elements', async () => {
  const code = [
    '<template>',
    '  <main>',
    '    <button>Save</button>',
    '  </main>',
    '</template>',
    '<script setup lang="ts">const label = "Save"</script>',
  ].join('\n')
  const result = await injectSource(code, 'src/App.vue?vue&type=script', projectRoot)

  assert.ok(result)
  assert.match(result.code, /data-visdiff-src='\{"file":"src\/App\.vue","line":2/)
  assert.match(result.code, /data-visdiff-src='\{"file":"src\/App\.vue","line":3/)
  assert.match(result.code, /<script setup lang="ts">const label/)
  assert.ok(result.map)

  const { descriptor } = parseVueSfc(result.code, { filename: 'src/App.vue' })
  assert.ok(descriptor.template)
  const compiled = compileTemplate({
    filename: 'src/App.vue',
    id: 'visdiff-vue-source-test',
    source: descriptor.template.content,
  })
  assert.deepEqual(compiled.errors, [])
})

void test('Vue source injection preserves existing source attributes', async () => {
  const code = '<template><button data-visdiff-src="{&quot;file&quot;:&quot;custom.vue&quot;}">Save</button></template>'
  const result = await injectSource(code, 'src/App.vue', projectRoot)

  assert.equal(result, null)
})

void test('Svelte source injection adds original file and line anchors and compiles', async () => {
  const code = [
    '<script>let count = 0</script>',
    '<main>',
    '  <button onclick={() => count++}>{count}</button>',
    '</main>',
  ].join('\n')
  const result = await injectSource(code, 'src/App.svelte?import', projectRoot)

  assert.ok(result)
  assert.match(result.code, /data-visdiff-src=\{"\{\\"file\\":\\"src\/App\.svelte\\",\\"line\\":2/)
  assert.match(result.code, /data-visdiff-src=\{"\{\\"file\\":\\"src\/App\.svelte\\",\\"line\\":3/)
  assert.ok(result.map)
  assert.doesNotThrow(() => compileSvelte(result.code, { filename: 'src/App.svelte', generate: 'client' }))
})

void test('Svelte source injection leaves script-only components unchanged', async () => {
  const result = await injectSource('<script>const value = 1</script>', 'src/OnlyScript.svelte', projectRoot)

  assert.equal(result, null)
})
