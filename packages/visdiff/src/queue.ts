import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { VisdiffTaskQueueSchema, type VisdiffTask } from './types'

const QUEUE_DIR = '.visdiff'
const QUEUE_FILE = 'tasks.json'
let mutationTail: Promise<void> = Promise.resolve()

export function queueFile(root: string = process.cwd()): string {
  return path.join(root, QUEUE_DIR, QUEUE_FILE)
}

export function newTaskId(): string {
  return `vdt_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`
}

export async function readPending(root: string): Promise<VisdiffTask[]> {
  let raw: string
  try {
    raw = await readFile(queueFile(root), 'utf8')
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return []
    throw error
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`Invalid JSON in ${queueFile(root)}`, { cause: error })
  }
  const result = VisdiffTaskQueueSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`Invalid task data in ${queueFile(root)}: ${result.error.issues[0]?.message ?? 'schema mismatch'}`)
  }
  return result.data
}

/** Atomic write: unique temp file + rename, so readers never observe a torn queue. */
async function writePending(root: string, tasks: VisdiffTask[]): Promise<void> {
  const file = queueFile(root)
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
  await writeFile(tmp, `${JSON.stringify(tasks, null, 2)}\n`, 'utf8')
  await rename(tmp, file)
}

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationTail.then(operation)
  mutationTail = result.then(() => undefined, () => undefined)
  return result
}

export async function appendTask(root: string, task: VisdiffTask): Promise<void> {
  await enqueueMutation(async () => {
    const tasks = await readPending(root)
    tasks.push(task)
    await writePending(root, tasks)
  })
}

export function clearPending(root: string): Promise<number> {
  return enqueueMutation(async () => {
    const tasks = await readPending(root)
    await writePending(root, [])
    return tasks.length
  })
}

/** Remove only tasks the agent actually applied, retaining newer browser edits. */
export function removePending(root: string, ids: string[]): Promise<number> {
  return enqueueMutation(async () => {
    const wanted = new Set(ids)
    const tasks = await readPending(root)
    const remaining = tasks.filter((task) => !wanted.has(task.id))
    await writePending(root, remaining)
    return tasks.length - remaining.length
  })
}
