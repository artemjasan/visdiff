import type {
  VisdiffChangeGeometry,
  VisdiffEdit,
  VisdiffGeometry,
  VisdiffSelectionGroup,
  VisdiffTaskElement,
} from '../types'

export interface SourceInfo {
  file: string
  line?: number
  column?: number
  component?: string
}

export interface ElementBaseline {
  geometry: VisdiffGeometry
  cssWidth: string
  cssHeight: string
  widthExtras: number
  heightExtras: number
  borderBox: boolean
  transform: string
  inlineStyles: Partial<Record<EditProp, InlineStyleSnapshot>>
}

export type EditRecord = VisdiffEdit
export type EditList = VisdiffEdit[]
export type LayoutProp =
  | 'display'
  | 'justify-content'
  | 'align-items'
  | 'flex-direction'
  | 'flex-wrap'
  | 'gap'
  | 'grid-template-columns'

export type EditProp = 'transform' | 'width' | 'height' | LayoutProp
export type EditMap = Partial<Record<EditProp, EditRecord>>
export type DragMode = 'move' | 'w' | 'h' | 'wh'
export const EDIT_PROPERTIES: readonly EditProp[] = [
  'transform',
  'width',
  'height',
  'display',
  'justify-content',
  'align-items',
  'flex-direction',
  'flex-wrap',
  'gap',
  'grid-template-columns',
]

export interface InlineStyleSnapshot {
  value: string
  priority: string
}

export type RestoreSnapshot = Partial<Record<EditProp, InlineStyleSnapshot>>

export interface StagedChange {
  element: VisdiffTaskElement
  edits: EditList
  geometry: VisdiffChangeGeometry
  selectionGroups: VisdiffSelectionGroup[]
  target: HTMLElement | SVGElement
  restore: RestoreSnapshot
}

export function composeMoveTransform(baseTransform: string, dx: number, dy: number): string {
  const normalized = baseTransform && baseTransform !== 'none' ? baseTransform.trim() : ''
  if (normalized.length === 0) return `translate(${dx}px, ${dy}px)`
  return `translate(${dx}px, ${dy}px) ${normalized}`
}

export function currentEditList(
  targetEdits: Partial<Record<EditProp, EditRecord>> | null,
): EditList {
  const list: EditList = []
  if (targetEdits === null) return list
  for (const prop of EDIT_PROPERTIES) {
    const edit = targetEdits[prop]
    if (edit === undefined) continue
    list.push({
      property: edit.property,
      from: edit.from,
      to: edit.to,
      kind: edit.kind,
      ...(edit.delta === undefined ? {} : { delta: edit.delta }),
    })
  }
  return list
}

export function sameElement(left: VisdiffTaskElement, right: VisdiffTaskElement): boolean {
  if (left.selector !== right.selector) return false
  if (left.source === null || right.source === null) return left.source === right.source
  return left.source.file === right.source.file
    && left.source.line === right.source.line
    && left.source.column === right.source.column
}
