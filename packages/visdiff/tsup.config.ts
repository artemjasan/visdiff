import { chmod } from 'node:fs/promises'
import { defineConfig } from 'tsup'

export default defineConfig([
  {
    // Bundler-side code: universal unplugin factory, generic adapters, and specialized Vite adapter
    entry: ['src/plugin.ts', 'src/vite-plugin.ts', 'src/adapters.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: false,
    target: 'node18',
    external: ['unplugin', 'vite', '@vue/compiler-dom', '@vue/compiler-sfc', 'svelte/compiler'],
  },
  {
    // npx CLI: help / tasks / clear / serve / mcp
    entry: ['src/cli.ts'],
    format: ['esm'],
    clean: false,
    sourcemap: false,
    target: 'node18',
    banner: { js: '#!/usr/bin/env node' },
    onSuccess: async () => {
      await chmod('dist/cli.js', 0o755)
    },
  },
  {
    // Browser overlay, self-executing IIFE, inlined into pages by the bundler plugins
    entry: ['src/client.ts'],
    format: ['iife'],
    clean: false,
    sourcemap: false,
    minify: true,
    noExternal: ['element-source'],
    outExtension: ({ format }) => {
      if (format !== 'iife') throw new Error(`unexpected client format: ${format}`)
      return { js: '.js' }
    },
    tsconfig: 'tsconfig.client.json',
  },
])
