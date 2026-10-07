import { readdir, readFile } from 'node:fs/promises'

const TAILWIND_CONFIG = /^tailwind\.config\.(?:js|cjs|mjs|ts|cts|mts)$/

async function hasTailwindDependency(root: string): Promise<boolean> {
  try {
    const pkg: unknown = JSON.parse(await readFile(`${root}/package.json`, 'utf8'))
    if (typeof pkg !== 'object' || pkg === null) return false
    return ['dependencies', 'devDependencies'].some((key) => {
      const group = (pkg as Record<string, unknown>)[key]
      return typeof group === 'object' && group !== null
        && ('tailwindcss' in group || '@tailwindcss/vite' in group)
    })
  } catch {
    return false
  }
}

/** Project-specific guidance appended to the agent workflow; empty when nothing is detected. */
export async function detectStylingHint(root: string): Promise<string> {
  let hasConfig = false
  try {
    hasConfig = (await readdir(root)).some((name) => TAILWIND_CONFIG.test(name))
  } catch {
    // An unreadable root only means no hint.
  }
  if (!hasConfig && !(await hasTailwindDependency(root))) return ''
  return 'Project styling: Tailwind CSS detected. Express visual edits with the project\'s Tailwind utility classes '
    + '(and its theme tokens) instead of inline styles or new custom CSS. '
    + 'Map observed from/to values to the nearest existing utility or scale step, and say so if no exact match exists.'
}
