import {
  EDIT_PROPERTIES,
  type ElementBaseline,
  type EditMap,
  type LayoutProp,
  type SourceInfo,
} from './model'
import { keepRecord, readBaseline, readStyleValue, restoreBaselineProperty } from './editing'
import type { VisdiffSelectionGroup } from '../types'

type EditableElement = HTMLElement | SVGElement

export interface LayoutEditorActions {
  selectedTargets(): EditableElement[]
  isApplying(): boolean
  sourceFor(target: HTMLElement): SourceInfo | null
  selectionGroup(target: HTMLElement): VisdiffSelectionGroup | undefined
  describeTarget(target: HTMLElement): string
  stage(
    target: HTMLElement,
    baseline: ElementBaseline,
    source: SourceInfo | null,
    edits: EditMap,
    selectionGroup?: VisdiffSelectionGroup,
  ): boolean
  updatePanel(count: number, target: HTMLElement | null, label: string): void
  notify(message: string): void
}

function sharedParent(targets: EditableElement[]): HTMLElement | null {
  if (targets.length < 2) return null
  const parent = targets[0]?.parentElement
  if (!(parent instanceof HTMLElement)) return null
  return targets.every((target) => target.parentElement === parent) ? parent : null
}

export class LayoutEditor {
  private container: HTMLElement | null = null
  private baseline: ElementBaseline | null = null
  private edits: EditMap = {}

  constructor(private readonly actions: LayoutEditorActions) {}

  get target(): HTMLElement | null {
    return this.container
  }

  hasChanges(): boolean {
    return Object.keys(this.edits).length > 0
  }

  refresh(): void {
    const selectedTargets = this.actions.selectedTargets()
    const nextContainer = sharedParent(selectedTargets)
    if (nextContainer !== this.container) {
      this.container = nextContainer
      this.baseline = nextContainer === null ? null : readBaseline(nextContainer)
      this.edits = {}
    }
    if (nextContainer === null) {
      this.baseline = null
      this.actions.updatePanel(selectedTargets.length, null, '')
      return
    }
    this.actions.updatePanel(
      selectedTargets.length,
      nextContainer,
      this.actions.describeTarget(nextContainer),
    )
  }

  apply(property: LayoutProp, value: string): void {
    const target = this.container
    if (this.actions.isApplying() || target === null) return
    this.baseline ??= readBaseline(target)

    if (property !== 'display') {
      const display = readStyleValue(target, 'display')
      if (!['flex', 'inline-flex', 'grid', 'inline-grid'].includes(display)) {
        target.style.setProperty('display', 'flex', 'important')
        keepRecord(this.edits, 'display', display, 'flex', 'style')
      }
    }

    const from = readStyleValue(target, property)
    if (from === value) return
    target.style.setProperty(property, value, 'important')
    keepRecord(this.edits, property, from, value, 'style')
    this.refresh()
    this.actions.notify(`Previewing ${property}: ${value}`)
  }

  resetPreview(): void {
    const target = this.container
    const baseline = this.baseline
    if (target !== null && baseline !== null) {
      for (const property of EDIT_PROPERTIES) {
        if (this.edits[property] !== undefined) restoreBaselineProperty(target, baseline, property)
      }
      this.baseline = readBaseline(target)
    }
    this.edits = {}
    this.refresh()
  }

  stage(): boolean {
    const target = this.container
    const baseline = this.baseline
    if (target === null || baseline === null || !this.hasChanges()) return false

    const staged = this.actions.stage(
      target,
      baseline,
      this.actions.sourceFor(target),
      this.edits,
      this.actions.selectionGroup(target),
    )
    this.edits = {}
    this.baseline = readBaseline(target)
    this.refresh()
    return staged
  }
}
