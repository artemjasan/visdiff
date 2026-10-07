import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { TailwindTheme, TokenMap } from './tailwind'

const EMPTY: TailwindTheme = { spacing: [], width: [], height: [], replaceDefaults: false, unit: 4 }
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.visdiff', '.next', '.nuxt', '.svelte-kit'])
const MAX_CSS_FILES = 200
const MAX_CSS_BYTES = 256 * 1024
const CONFIG_NAMES = ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts'].map((ext) => `tailwind.config.${ext}`)

/** Convert a CSS length to px; only absolute px/rem values are meaningful for class suggestions. */
export function toPx(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const match = /^\s*(-?\d*\.?\d+)\s*(px|rem)?\s*$/.exec(value)
  if (match?.[1] === undefined) return null
  const n = Number(match[1])
  return match[2] === 'rem' ? n * 16 : n
}

function tokensFrom(source: unknown): TokenMap {
  if (typeof source !== 'object' || source === null) return []
  const tokens: Array<readonly [string, number]> = []
  for (const [name, value] of Object.entries(source)) {
    if (name === 'DEFAULT' || name.includes('/')) continue
    const px = toPx(value)
    if (px !== null && px >= 0) tokens.push([name, px])
  }
  return tokens
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined
}

/** Tailwind v3: read static spacing/width/height values from a JS config; functions and TS-only configs are ignored. */
export function themeFromV3Config(config: unknown): TailwindTheme {
  const theme = record(record(config)?.theme)
  if (theme === undefined) return EMPTY
  const extend = record(theme.extend)
  const spacingOverride = record(theme.spacing)
  return {
    spacing: [...tokensFrom(spacingOverride), ...tokensFrom(extend?.spacing)],
    width: [...tokensFrom(record(theme.width)), ...tokensFrom(extend?.width)],
    height: [...tokensFrom(record(theme.height)), ...tokensFrom(extend?.height)],
    replaceDefaults: spacingOverride !== undefined,
    unit: 4,
  }
}

function themeBlocks(css: string): string[] {
  const blocks: string[] = []
  let from = 0
  for (;;) {
    const at = css.indexOf('@theme', from)
    if (at === -1) return blocks
    const open = css.indexOf('{', at)
    if (open === -1) return blocks
    let depth = 0
    let end = open
    for (; end < css.length; end++) {
      if (css[end] === '{') depth++
      else if (css[end] === '}' && --depth === 0) break
    }
    blocks.push(css.slice(open + 1, end))
    from = end + 1
  }
}

/** Tailwind v4: read `--spacing`, `--spacing-*`, `--width-*` and `--height-*` from `@theme` blocks. */
export function themeFromV4Css(cssFiles: string[]): TailwindTheme {
  let unit = 4
  let replaceDefaults = false
  const spacing: Array<readonly [string, number]> = []
  const width: Array<readonly [string, number]> = []
  const height: Array<readonly [string, number]> = []
  for (const css of cssFiles) {
    for (const block of themeBlocks(css)) {
      for (const match of block.matchAll(/--([\w*-]+)\s*:\s*([^;]+);/g)) {
        const [, name, value] = match
        if (name === undefined || value === undefined) continue
        if (name === 'spacing') {
          const px = toPx(value)
          if (px !== null && px > 0) unit = px
        } else if (name === 'spacing-*') {
          if (value.trim() === 'initial') replaceDefaults = true
        } else if (name.startsWith('spacing-')) {
          const px = toPx(value)
          if (px !== null && px >= 0) spacing.push([name.slice('spacing-'.length), px])
        } else if (name.startsWith('width-')) {
          const px = toPx(value)
          if (px !== null && px >= 0) width.push([name.slice('width-'.length), px])
        } else if (name.startsWith('height-')) {
          const px = toPx(value)
          if (px !== null && px >= 0) height.push([name.slice('height-'.length), px])
        }
      }
    }
  }
  return { spacing, width, height, replaceDefaults, unit }
}

async function collectCss(root: string): Promise<string[]> {
  const files: string[] = []
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 4 || files.length >= MAX_CSS_FILES) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) await walk(path.join(dir, entry.name), depth + 1)
      } else if (entry.name.endsWith('.css') && files.length < MAX_CSS_FILES) {
        files.push(path.join(dir, entry.name))
      }
    }
  }
  await walk(root, 0)
  const contents: string[] = []
  for (const file of files) {
    try {
      const text = await readFile(file, 'utf8')
      if (text.length <= MAX_CSS_BYTES && text.includes('@theme')) contents.push(text)
    } catch {
      // Unreadable stylesheet: ignore.
    }
  }
  return contents
}

async function loadV3Config(root: string): Promise<unknown> {
  let names: string[]
  try {
    names = await readdir(root)
  } catch {
    return undefined
  }
  const name = CONFIG_NAMES.find((candidate) => names.includes(candidate))
  if (name === undefined) return undefined
  try {
    const file = path.join(root, name)
    // The mtime query defeats the ESM cache so a long-running MCP server sees config edits.
    const url = `${pathToFileURL(file).href}?v=${Math.trunc((await stat(file)).mtimeMs)}`
    const mod = await import(url) as { default?: unknown }
    return mod.default ?? mod
  } catch {
    return undefined
  }
}

/** Best-effort project theme; returns defaults when nothing could be read. */
export async function loadTailwindTheme(root: string, v4: boolean): Promise<TailwindTheme> {
  if (v4) return themeFromV4Css(await collectCss(root))
  return themeFromV3Config(await loadV3Config(root))
}
