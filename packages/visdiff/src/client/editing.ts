import {
  composeMoveTransform,
  currentEditList,
  type DragMode,
  EDIT_PROPERTIES,
  type EditMap,
  type EditProp,
  type EditRecord,
  type ElementBaseline,
  type InlineStyleSnapshot,
  type SourceInfo,
} from './model'
import type { VisdiffSelectionGroup } from '../types'

type EditableElement = HTMLElement | SVGElement

interface KeyboardMove {
  baseline: ElementBaseline
  edits: EditMap
  source: SourceInfo | null
  dx: number
  dy: number
}

interface DragRecord {
  baseline: ElementBaseline
  edits: EditMap
  source: SourceInfo | null
}

export interface ElementEditorActions {
  activeTargets(): EditableElement[]
  selectedTarget(): EditableElement | null
  sourceFor(target: EditableElement): SourceInfo | null
  selectionGroup(target: EditableElement): VisdiffSelectionGroup | undefined
  isApplying(): boolean
  stage(
    target: EditableElement,
    baseline: ElementBaseline,
    source: SourceInfo | null,
    edits: EditMap,
    selectionGroup?: VisdiffSelectionGroup,
  ): boolean
  afterSelectedDrag(target: EditableElement): void
  afterGroupDrag(): void
}

export function readBaseline(element: EditableElement): ElementBaseline {
  const computed = getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  const widthExtras = computed.boxSizing === 'border-box'
    ? 0
    : Number.parseFloat(computed.paddingLeft) + Number.parseFloat(computed.paddingRight)
      + Number.parseFloat(computed.borderLeftWidth) + Number.parseFloat(computed.borderRightWidth)
  const heightExtras = computed.boxSizing === 'border-box'
    ? 0
    : Number.parseFloat(computed.paddingTop) + Number.parseFloat(computed.paddingBottom)
      + Number.parseFloat(computed.borderTopWidth) + Number.parseFloat(computed.borderBottomWidth)
  const inlineStyles: Partial<Record<EditProp, InlineStyleSnapshot>> = {}
  for (const property of EDIT_PROPERTIES) {
    inlineStyles[property] = {
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property),
    }
  }
  return {
    geometry: {
      x: Math.round(rect.x * 100) / 100,
      y: Math.round(rect.y * 100) / 100,
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100,
    },
    cssWidth: computed.width,
    cssHeight: computed.height,
    widthExtras,
    heightExtras,
    borderBox: computed.boxSizing === 'border-box',
    transform: computed.transform,
    inlineStyles,
  }
}

export function readStyleValue(element: EditableElement, property: EditProp): string {
  return getComputedStyle(element).getPropertyValue(property).trim()
}

export function keepRecord(
  targetEdits: EditMap | null,
  property: EditProp,
  from: string,
  to: string,
  kind: EditRecord['kind'],
  delta?: { x: number; y: number },
): void {
  if (targetEdits === null) return
  const previous = targetEdits[property]
  if (previous !== undefined) {
    previous.to = to
    if (delta !== undefined) previous.delta = delta
    return
  }
  targetEdits[property] = { property, from, to, kind, ...(delta === undefined ? {} : { delta }) }
}

export function restoreInlineStyle(
  element: EditableElement,
  property: string,
  value: string,
  priority: string,
): void {
  if (value.length === 0) element.style.removeProperty(property)
  else element.style.setProperty(property, value, priority)
}

export function restoreBaselineProperty(
  element: EditableElement,
  baseline: ElementBaseline,
  property: EditProp,
): void {
  const snapshot = baseline.inlineStyles[property]
  if (snapshot === undefined) return
  restoreInlineStyle(element, property, snapshot.value, snapshot.priority)
}

function ensureGeometryBox(target: EditableElement, edits: EditMap): void {
  if (!(target instanceof HTMLElement) || readStyleValue(target, 'display') !== 'inline') return
  target.style.setProperty('display', 'inline-block', 'important')
  keepRecord(edits, 'display', 'inline', 'inline-block', 'style')
}

export class ElementEditor {
  private readonly keyboardMoves = new Map<EditableElement, KeyboardMove>()

  constructor(private readonly actions: ElementEditorActions) {}

  clearKeyboardMoves(): void {
    this.keyboardMoves.clear()
  }

  moveByKeyboard(dx: number, dy: number): void {
    if (this.actions.isApplying()) return
    for (const target of this.actions.activeTargets()) {
      let move = this.keyboardMoves.get(target)
      if (move === undefined) {
        move = {
          baseline: readBaseline(target),
          edits: {},
          source: this.actions.sourceFor(target),
          dx: 0,
          dy: 0,
        }
        this.keyboardMoves.set(target, move)
      }
      ensureGeometryBox(target, move.edits)
      move.dx += dx
      move.dy += dy
      const value = composeMoveTransform(move.baseline.transform, move.dx, move.dy)
      target.style.setProperty('transform', value, 'important')
      keepRecord(move.edits, 'transform', move.baseline.transform, value, 'move', { x: move.dx, y: move.dy })
      this.actions.stage(
        target,
        move.baseline,
        move.source,
        move.edits,
        this.actions.selectionGroup(target),
      )
    }
  }

  startDrag(event: PointerEvent, mode: DragMode): void {
    const targets = this.actions.activeTargets()
    if (this.actions.isApplying() || targets.length === 0) return
    event.preventDefault()
    event.stopPropagation()
    this.clearKeyboardMoves()

    const records = new Map<EditableElement, DragRecord>()
    const dragRects = new Map<EditableElement, DOMRect>()
    for (const target of targets) {
      records.set(target, {
        baseline: readBaseline(target),
        edits: {},
        source: this.actions.sourceFor(target),
      })
      dragRects.set(target, target.getBoundingClientRect())
    }

    const startX = event.clientX
    const startY = event.clientY
    const onMove = (moveEvent: PointerEvent): void => {
      const dx = Math.round(moveEvent.clientX - startX)
      const dy = Math.round(moveEvent.clientY - startY)
      if (dx === 0 && dy === 0) return
      for (const target of targets) {
        const record = records.get(target)
        if (record === undefined) continue
        const base = record.baseline
        const gestureRect = dragRects.get(target) ?? target.getBoundingClientRect()
        ensureGeometryBox(target, record.edits)
        if (mode === 'move') {
          const value = composeMoveTransform(base.transform, dx, dy)
          target.style.setProperty('transform', value, 'important')
          keepRecord(record.edits, 'transform', base.transform, value, 'move', { x: dx, y: dy })
        }
        if (mode === 'w' || mode === 'wh') {
          const outerWidth = Math.max(8, Math.round(gestureRect.width + dx))
          const cssWidth = base.borderBox ? outerWidth : Math.max(0, outerWidth - base.widthExtras)
          const value = `${cssWidth}px`
          target.style.setProperty('width', value, 'important')
          keepRecord(record.edits, 'width', base.cssWidth, value, 'resize')
        }
        if (mode === 'h' || mode === 'wh') {
          const outerHeight = Math.max(8, Math.round(gestureRect.height + dy))
          const cssHeight = base.borderBox ? outerHeight : Math.max(0, outerHeight - base.heightExtras)
          const value = `${cssHeight}px`
          target.style.setProperty('height', value, 'important')
          keepRecord(record.edits, 'height', base.cssHeight, value, 'resize')
        }
      }
    }

    const commit = (): void => {
      for (const [target, record] of records) {
        if (currentEditList(record.edits).length === 0) continue
        if (this.actions.stage(
          target,
          record.baseline,
          record.source,
          record.edits,
          this.actions.selectionGroup(target),
        )) {
          if (this.actions.selectedTarget() === target) this.actions.afterSelectedDrag(target)
        }
      }
      if (targets.length > 1) this.actions.afterGroupDrag()
    }

    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove, true)
      document.removeEventListener('pointerup', onUp, true)
      document.removeEventListener('pointercancel', onUp, true)
      commit()
    }
    document.addEventListener('pointermove', onMove, true)
    document.addEventListener('pointerup', onUp, true)
    document.addEventListener('pointercancel', onUp, true)
  }
}
