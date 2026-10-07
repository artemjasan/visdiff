import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { annotateTasks, type TailwindTheme } from './tailwind'
import { loadTailwindTheme } from './tailwind-theme'
import type { VisdiffTask } from './types'

const TAILWIND_CONFIG = /^tailwind\.config\.(?:js|cjs|mjs|ts|cts|mts)$/

export interface TailwindInfo {
  /** True for Tailwind v4 (dependency range >= 4 or the `@tailwindcss/*` packages). */
  v4: boolean
  theme: TailwindTheme
}

async function readDependencies(root: string): Promise<Record<string, string>> {
  try {
    const pkg: unknown = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
    if (typeof pkg !== 'object' || pkg === null) return {}
    const merged: Record<string, string> = {}
    for (const key of ['dependencies', 'devDependencies']) {
      const group = (pkg as Record<string, unknown>)[key]
      if (typeof group !== 'object' || group === null) continue
      for (const [name, range] of Object.entries(group)) {
        if (typeof range === 'string') merged[name] = range
      }
    }
    return merged
  } catch {
    return {}
  }
}

/** Detect Tailwind in the project root; null when it is not used. */
export async function detectTailwind(root: string): Promise<TailwindInfo | null> {
  const deps = await readDependencies(root)
  let hasConfig = false
  try {
    hasConfig = (await readdir(root)).some((name) => TAILWIND_CONFIG.test(name))
  } catch {
    // An unreadable root only means no detection.
  }
  const range = deps.tailwindcss
  const scoped = Object.keys(deps).some((name) => name.startsWith('@tailwindcss/'))
  if (range === undefined && !scoped && !hasConfig) return null
  const major = range === undefined ? undefined : /\d+/.exec(range)?.[0]
  const v4 = scoped || (major !== undefined && Number(major) >= 4)
  return { v4, theme: await loadTailwindTheme(root, v4) }
}

/** Project-specific guidance appended to the agent workflow; empty when nothing is detected. */
export async function detectStylingHint(root: string): Promise<string> {
  if (await detectTailwind(root) === null) return ''
  return 'Project styling: Tailwind CSS detected. Express visual edits with the project\'s Tailwind utility classes '
    + '(and its theme tokens) instead of inline styles or new custom CSS. '
    + 'Edits may carry a "tailwind" hint: "suggestion" is the class(es) for the "to" value, "replaces" lists existing classes it should replace, '
    + 'and exact=false means the value was rounded to the default scale (see "alternative" for an arbitrary value). '
    + '"responsive" is the same suggestion limited to the captured viewport\'s "breakpoint" and up (replacing "replacesAtBreakpoint"); choose it only when the change should not apply on smaller screens, and ask if that is unclear. Treat hints as starting points: verify the result against the project\'s theme. Remember element.classes shows the current classes.'
}

/** Tasks annotated with Tailwind hints when the project uses Tailwind; otherwise returned unchanged. */
export async function withStylingHints(root: string, tasks: VisdiffTask[]): Promise<unknown[]> {
  const info = await detectTailwind(root)
  return info === null ? tasks : annotateTasks(tasks, { v4: info.v4, theme: info.theme })
}
