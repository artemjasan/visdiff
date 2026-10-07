import type { VisdiffEdit, VisdiffTask } from './types'

export interface TailwindHint {
  /** Utility class(es) that reproduce the edit's `to` value. */
  suggestion: string
  /** False when the value was rounded to the nearest scale step or approximated. */
  exact: boolean
  /** Arbitrary-value alternative when `suggestion` is not exact. */
  alternative?: string
  /** Existing unprefixed classes on the element that this suggestion should replace. */
  replaces?: string[]
}

export type HintedEdit = VisdiffEdit & { tailwind?: TailwindHint }
export type HintedTask = Omit<VisdiffTask, 'changes'> & {
  changes: Array<Omit<VisdiffTask['changes'][number], 'edits'> & { edits: HintedEdit[] }>
}

/** Named spacing tokens from the project's theme, in px. */
export type TokenMap = ReadonlyArray<readonly [string, number]>

export interface TailwindTheme {
  /** Tokens usable by `gap-*`, `w-*` and `h-*`. */
  spacing: TokenMap
  width: TokenMap
  height: TokenMap
  /** True when the project removed Tailwind's default spacing scale. */
  replaceDefaults: boolean
  /** v4 `--spacing` base unit in px (default 4). */
  unit: number
}

export interface TailwindOptions {
  /** Tailwind v4 accepts any spacing multiple (`w-31`); v3 only the default scale. */
  v4?: boolean
  theme?: TailwindTheme
}

interface Scale {
  v4: boolean
  generate: boolean
  unit: number
  defaults: TokenMap
  tokens: TokenMap
}

// Default spacing scale in px (1 unit = 0.25rem = 4px at a 16px root).
const SCALE: ReadonlyArray<readonly [string, number]> = [
  ['0', 0], ['px', 1], ['0.5', 2], ['1', 4], ['1.5', 6], ['2', 8], ['2.5', 10], ['3', 12], ['3.5', 14],
  ['4', 16], ['5', 20], ['6', 24], ['7', 28], ['8', 32], ['9', 36], ['10', 40], ['11', 44], ['12', 48],
  ['14', 56], ['16', 64], ['20', 80], ['24', 96], ['28', 112], ['32', 128], ['36', 144], ['40', 160],
  ['44', 176], ['48', 192], ['52', 208], ['56', 224], ['60', 240], ['64', 256], ['72', 288], ['80', 320],
  ['96', 384],
]

interface Keyword { cls: string; exact?: boolean }

const KEYWORDS: Record<string, Record<string, Keyword>> = {
  display: {
    flex: { cls: 'flex' }, 'inline-flex': { cls: 'inline-flex' }, grid: { cls: 'grid' },
    'inline-grid': { cls: 'inline-grid' }, block: { cls: 'block' }, none: { cls: 'hidden' },
  },
  'flex-direction': {
    row: { cls: 'flex-row' }, column: { cls: 'flex-col' },
    'row-reverse': { cls: 'flex-row-reverse' }, 'column-reverse': { cls: 'flex-col-reverse' },
  },
  'flex-wrap': {
    wrap: { cls: 'flex-wrap' }, nowrap: { cls: 'flex-nowrap' }, 'wrap-reverse': { cls: 'flex-wrap-reverse' },
  },
  'justify-content': {
    'flex-start': { cls: 'justify-start' }, start: { cls: 'justify-start', exact: false },
    'flex-end': { cls: 'justify-end' }, end: { cls: 'justify-end', exact: false },
    center: { cls: 'justify-center' }, 'space-between': { cls: 'justify-between' },
    'space-around': { cls: 'justify-around' }, 'space-evenly': { cls: 'justify-evenly' },
    stretch: { cls: 'justify-stretch' }, normal: { cls: 'justify-normal' },
  },
  'align-items': {
    'flex-start': { cls: 'items-start' }, start: { cls: 'items-start', exact: false },
    'flex-end': { cls: 'items-end' }, end: { cls: 'items-end', exact: false },
    center: { cls: 'items-center' }, baseline: { cls: 'items-baseline' }, stretch: { cls: 'items-stretch' },
  },
}

const REPLACED: Record<string, RegExp> = {
  display: /^(?:flex|inline-flex|grid|inline-grid|block|inline-block|inline|hidden|contents|table|flow-root)$/,
  'flex-direction': /^flex-(?:row|col)(?:-reverse)?$/,
  'flex-wrap': /^flex-(?:wrap|nowrap|wrap-reverse)$/,
  'justify-content': /^justify-(?!items-|self-)/,
  'align-items': /^items-/,
  gap: /^gap-/,
  'grid-template-columns': /^grid-cols-/,
  width: /^w-/,
  height: /^h-/,
}

function parsePx(value: string): number | null {
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim())
  return match?.[1] === undefined ? null : Number(match[1])
}

function buildScale(options: TailwindOptions, group: 'spacing' | 'width' | 'height'): Scale {
  const theme = options.theme
  const v4 = options.v4 === true
  const unit = theme?.unit ?? 4
  const defaults = theme?.replaceDefaults === true ? [] : v4 ? [] : SCALE
  const tokens = theme === undefined ? [] : [...(group === 'spacing' ? [] : theme.spacing), ...theme[group]]
  return { v4, generate: v4 && theme?.replaceDefaults !== true, unit, defaults, tokens }
}

function spacing(px: number, scale: Scale): { token: string; exact: boolean } | null {
  if (px < 0) return null
  const named = scale.tokens.find(([, size]) => size === px) ?? scale.defaults.find(([, size]) => size === px)
  if (named !== undefined) return { token: named[0], exact: true }
  if (scale.generate) {
    const steps = px / scale.unit
    if (Number.isInteger(steps * 2)) return { token: String(steps), exact: true }
  }
  const pool = [...scale.defaults, ...scale.tokens]
  const generated: Array<readonly [string, number]> = scale.generate ? [[String(Math.round(px / scale.unit)), Math.round(px / scale.unit) * scale.unit]] : []
  const candidates = [...pool, ...generated]
  if (candidates.length === 0) return null
  const nearest = candidates.reduce((best, step) => Math.abs(step[1] - px) < Math.abs(best[1] - px) ? step : best)
  return { token: nearest[0], exact: false }
}

function arbitrary(value: string): string {
  return `[${value.trim().replace(/\s+/g, '_')}]`
}

function sizeHint(prefix: 'w' | 'h', value: string, scale: Scale): Omit<TailwindHint, 'replaces'> | null {
  const trimmed = value.trim()
  if (trimmed === '100%') return { suggestion: `${prefix}-full`, exact: true }
  if (trimmed === 'auto') return { suggestion: `${prefix}-auto`, exact: true }
  const px = parsePx(trimmed)
  if (px === null) return trimmed === '' ? null : { suggestion: `${prefix}-${arbitrary(trimmed)}`, exact: true }
  const step = spacing(px, scale)
  if (step === null) return null
  const alt = `${prefix}-${arbitrary(`${px}px`)}`
  return step.exact
    ? { suggestion: `${prefix}-${step.token}`, exact: true }
    : { suggestion: `${prefix}-${step.token}`, exact: false, alternative: alt }
}

function gapHint(value: string, scale: Scale): Omit<TailwindHint, 'replaces'> | null {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  const toToken = (part: string) => part === 'normal' ? { token: '0', exact: false } : (() => {
    const px = parsePx(part)
    return px === null ? null : spacing(px, scale)
  })()
  const tokens = parts.map(toToken)
  if (tokens.length === 0 || tokens.some((token) => token === null)) return null
  const [row, column] = tokens
  if (row === null || row === undefined) return null
  const same = column === undefined || column === null || (row.token === column.token)
  if (same) {
    const hint: Omit<TailwindHint, 'replaces'> = { suggestion: `gap-${row.token}`, exact: row.exact }
    if (!row.exact) hint.alternative = `gap-${arbitrary(parts[0] ?? '')}`
    return hint
  }
  return {
    suggestion: `gap-y-${row.token} gap-x-${column?.token ?? row.token}`,
    exact: row.exact && (column?.exact ?? true),
  }
}

function gridColumnsHint(value: string): Omit<TailwindHint, 'replaces'> | null {
  const tracks = value.trim().split(/\s+/).filter(Boolean)
  if (tracks.length === 0 || tracks[0] === 'none') return null
  if (tracks.every((track) => track === tracks[0]) && tracks.length <= 12) {
    return { suggestion: `grid-cols-${tracks.length}`, exact: tracks.length === 1 || tracks[0]?.endsWith('px') === true }
  }
  return { suggestion: `grid-cols-${arbitrary(tracks.join(' '))}`, exact: true }
}

/** Suggest Tailwind utilities for one edit; null when the edit has no sensible mapping (e.g. move). */
export function suggestTailwind(edit: VisdiffEdit, classes: string[] = [], options: TailwindOptions = {}): TailwindHint | null {
  let base: Omit<TailwindHint, 'replaces'> | null = null
  const keywords = KEYWORDS[edit.property]
  if (keywords !== undefined) {
    const keyword = keywords[edit.to.trim()]
    if (keyword !== undefined) base = { suggestion: keyword.cls, exact: keyword.exact ?? true }
  } else if (edit.property === 'width') base = sizeHint('w', edit.to, buildScale(options, 'width'))
  else if (edit.property === 'height') base = sizeHint('h', edit.to, buildScale(options, 'height'))
  else if (edit.property === 'gap') base = gapHint(edit.to, buildScale(options, 'spacing'))
  else if (edit.property === 'grid-template-columns') base = gridColumnsHint(edit.to)
  if (base === null) return null

  const pattern = REPLACED[edit.property]
  const suggested = new Set(base.suggestion.split(' '))
  const replaces = pattern === undefined
    ? []
    : classes.filter((name) => !name.includes(':') && pattern.test(name) && !suggested.has(name))
  return { ...base, ...(replaces.length > 0 ? { replaces } : {}) }
}

/** Attach Tailwind hints to every edit that has one. Input tasks are not mutated. */
export function annotateTasks(tasks: VisdiffTask[], options: TailwindOptions = {}): HintedTask[] {
  return tasks.map((task) => ({
    ...task,
    changes: task.changes.map((change) => ({
      ...change,
      edits: change.edits.map((edit): HintedEdit => {
        const hint = suggestTailwind(edit, change.element.classes, options)
        return hint === null ? edit : { ...edit, tailwind: hint }
      }),
    })),
  }))
}
