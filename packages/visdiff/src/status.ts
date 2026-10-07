import type { VisdiffTask } from './types'

/** One line per task plus a total, suitable for `visdiff status`. */
export function formatStatus(tasks: VisdiffTask[]): string {
  if (tasks.length === 0) return 'No pending visual tasks.'
  const lines = [`${tasks.length} pending visual task(s):`]
  for (const task of tasks) {
    const edits = task.changes.reduce((total, change) => total + change.edits.length, 0)
    const note = task.note === undefined ? '' : ` — ${task.note.length > 60 ? `${task.note.slice(0, 59)}…` : task.note}`
    lines.push(
      `  ${task.id}  ${task.changes.length} element(s), ${edits} edit(s)  ${task.viewport.width}×${task.viewport.height}  ${task.url}${note}`,
    )
  }
  return lines.join('\n')
}
