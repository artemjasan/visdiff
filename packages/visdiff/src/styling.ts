import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { annotateTasks, type HintedTask, type TailwindTheme } from './tailwind'
import { loadTailwindTheme } from './tailwind-theme'
import type { VisdiffTask } from './types'

const TAILWIND_CONFIG = /^tailwind\.config\.(?:js|cjs|mjs|ts|cts|mts)$/

export interface TailwindInfo {
  /** True when the core Tailwind package, or a known v4 integration, identifies v4. */
  v4: boolean
  theme: TailwindTheme
}

const V4_INTEGRATIONS = [
  '@tailwindcss/cli',
  '@tailwindcss/node',
  '@tailwindcss/oxide',
  '@tailwindcss/postcss',
  '@tailwindcss/vite',
]

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

function majorVersion(range: string | undefined): number | null {
  if (range === undefined) return null
  const match = /^\s*(?:[~^>=v]|workspace:)*(\d+)/.exec(range)
  return match?.[1] === undefined ? null : Number(match[1])
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
  const integrationVersion = V4_INTEGRATIONS
    .map((name) => majorVersion(deps[name]))
    .find((major) => major !== null)
  const coreMajor = majorVersion(range)
  if (range === undefined && integrationVersion === undefined && !hasConfig) return null
  const v4 = coreMajor === null ? (integrationVersion ?? 0) >= 4 : coreMajor >= 4
  return { v4, theme: await loadTailwindTheme(root, v4) }
}

/** Project-specific guidance; empty when Tailwind is not detected. */
export function stylingGuidance(info: TailwindInfo | null): string {
  if (info === null) return ''
  return `Project styling: Tailwind CSS detected. Express visual edits with the project's Tailwind utility classes `
    + `(and its theme tokens) instead of inline styles or new custom CSS. Edits may carry a "tailwind" hint: `
    + '"suggestion" is the class(es) for the "to" value, "replaces" lists existing classes it should replace, '
    + 'and exact=false means the value was rounded to the nearest available scale token (see "alternative" for an arbitrary value). '
    + '"responsive" is the same suggestion limited to the captured viewport\'s "breakpoint" and up (replacing "replacesAtBreakpoint"); '
    + 'choose it only when the change should not apply on smaller screens, and ask if that is unclear. '
    + "Treat hints as starting points: verify the result against the project's theme. Remember element.classes shows the current classes."
}

/** Add theme-aware suggestions when Tailwind is detected; otherwise return the original tasks. */
export function annotateProjectTasks(
  tasks: VisdiffTask[],
  info: TailwindInfo | null,
): Array<VisdiffTask | HintedTask> {
  return info === null ? tasks : annotateTasks(tasks, { v4: info.v4, theme: info.theme })
}
