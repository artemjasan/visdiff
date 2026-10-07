import { z } from 'zod'

/** Source anchor resolved in the browser for a manipulated element. */
export const VisdiffSourceSchema = z.object({
  file: z.string().min(1),
  line: z.number().optional(),
  column: z.number().optional(),
  component: z.string().optional(),
})

/** One explicitly applied visual edit. */
export const VisdiffEditSchema = z.object({
  property: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  kind: z.enum(['move', 'resize', 'style']).optional(),
  note: z.preprocess(
    (value) => typeof value === 'string' ? value.trim() : value,
    z.string().max(400).optional().transform((value) => value && value.length > 0 ? value : undefined),
  ),
}).superRefine((edit, ctx) => {
  if (edit.from === undefined && edit.to === undefined) {
    ctx.addIssue({ code: 'custom', message: 'an edit requires a from or to value' })
  }
}).transform((edit) => {
  const from = edit.from ?? ''
  const to = edit.to ?? from
  const kind = edit.kind ?? 'resize'
  const note = edit.note
  return { property: edit.property, from, to, kind, ...(note ? { note } : {}) }
})

export const VisdiffTaskElementSchema = z.object({
  tag: z.string().min(1),
  selector: z.string().min(1),
  text: z.string().default(''),
  source: z.union([VisdiffSourceSchema, z.null()]).default(null),
})

/** Links element changes that came from one multi-selection operation. */
export const VisdiffSelectionGroupSchema = z.object({
  id: z.string().min(1),
  selectedCount: z.number().int().min(2),
  role: z.enum(['member', 'layout-container']),
})

/** Changes made to one rendered element within a visual task batch. */
export const VisdiffTaskChangeSchema = z.object({
  element: VisdiffTaskElementSchema,
  edits: z.array(VisdiffEditSchema).min(1),
  selectionGroups: z.array(VisdiffSelectionGroupSchema).optional(),
})

/** What the browser overlay sends after accumulating one or more element edits. */
export const VisdiffTaskPayloadSchema = z.object({
  url: z.string().min(1),
  viewport: z.object({
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
  }),
  changes: z.array(VisdiffTaskChangeSchema).min(1),
  note: z.preprocess(
    (value) => typeof value === 'string' ? value.trim() : value,
    z.string().max(1000).optional().transform((value) => value && value.length > 0 ? value : undefined),
  ),
})

/** What reaches the queue file and the agent. */
export const TASK_SCHEMA_VERSION = 1

export const VisdiffTaskSchema = VisdiffTaskPayloadSchema.extend({
  /** Absent in tasks queued before versioning; those are treated as version 1. */
  schemaVersion: z.number().int().positive().default(TASK_SCHEMA_VERSION),
  id: z.string().min(1),
  receivedAt: z.iso.datetime(),
})

export const VisdiffTaskQueueSchema = z.array(VisdiffTaskSchema)

export type VisdiffSource = z.infer<typeof VisdiffSourceSchema>
export type VisdiffEdit = z.infer<typeof VisdiffEditSchema>
export type VisdiffTaskElement = z.infer<typeof VisdiffTaskElementSchema>
export type VisdiffSelectionGroup = z.infer<typeof VisdiffSelectionGroupSchema>
export type VisdiffTaskChange = z.infer<typeof VisdiffTaskChangeSchema>
export type VisdiffTaskPayload = z.infer<typeof VisdiffTaskPayloadSchema>
export type VisdiffTask = z.infer<typeof VisdiffTaskSchema>

export interface VisdiffOptions {
  /** project root used for the task queue file (default: process.cwd()) */
  root?: string
  /** first port for the standalone endpoint server (default: 9090) */
  port?: number
  /** force the standalone server on; otherwise it starts only when NODE_ENV=development */
  enabled?: boolean
}
