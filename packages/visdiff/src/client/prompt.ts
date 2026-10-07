import type { VisdiffTaskChange } from '../types'

export interface PromptContext {
  url: string
  viewport: { width: number; height: number }
  note?: string
}

function describeLocation(change: VisdiffTaskChange): string {
  const { source, selector } = change.element
  if (source === null) return selector
  const line = source.line === undefined ? '' : `:${source.line}${source.column === undefined ? '' : `:${source.column}`}`
  const component = source.component === undefined ? '' : ` (${source.component})`
  return `${source.file}${line}${component}`
}

/** Plain-text task for pasting into any coding agent without the CLI or MCP. */
export function buildPrompt(changes: VisdiffTaskChange[], context: PromptContext): string {
  const lines = [
    'Apply these visual changes made in the browser to the source code.',
    'They describe the desired rendered result; inspect the source and implement them with the project\'s own styling approach rather than copying the values literally.',
    '',
    `Page: ${context.url}`,
    `Viewport: ${context.viewport.width}×${context.viewport.height}px`,
  ]
  if (context.note !== undefined && context.note.trim().length > 0) lines.push(`Note: ${context.note.trim()}`)

  changes.forEach((change, index) => {
    lines.push('', `${index + 1}. <${change.element.tag}> ${describeLocation(change)}`)
    if (change.element.text.length > 0) lines.push(`   text: "${change.element.text}"`)
    const classes = change.element.classes
    if (classes !== undefined && classes.length > 0) lines.push(`   classes: ${classes.join(' ')}`)
    for (const edit of change.edits) {
      const note = edit.note === undefined ? '' : ` — ${edit.note}`
      lines.push(`   - ${edit.property}: ${edit.from} → ${edit.to}${note}`)
    }
  })
  return lines.join('\n')
}
