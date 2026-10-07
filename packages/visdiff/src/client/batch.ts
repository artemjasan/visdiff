import {
  currentEditList,
  EDIT_PROPERTIES,
  sameElement,
  type EditMap,
  type EditProp,
  type ElementBaseline,
  type EditList,
  type SourceInfo,
  type StagedChange,
} from './model'
import { restoreBaselineProperty, restoreInlineStyle } from './editing'
import { cssPath } from './source'
import type { VisdiffSelectionGroup, VisdiffTaskChange, VisdiffTaskElement } from '../types'

type EditableElement = HTMLElement | SVGElement

interface ChangeBatchActions {
  changed(): void
  notify(message: string): void
}

function classTokens(target: EditableElement): { classes?: string[] } {
  const classes = (target.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 64)
  return classes.length > 0 ? { classes } : {}
}

export class ChangeBatch {
  private readonly items: StagedChange[] = []

  constructor(private readonly actions: ChangeBatchActions) {}

  get changes(): StagedChange[] {
    return this.items
  }

  get isEmpty(): boolean {
    return this.items.length === 0
  }

  stage(
    target: EditableElement,
    baseline: ElementBaseline,
    source: SourceInfo | null,
    targetEdits: EditMap,
    selectionGroup?: VisdiffSelectionGroup,
  ): boolean {
    const incoming = currentEditList(targetEdits)
    if (incoming.length === 0) return false

    const element: VisdiffTaskElement = {
      tag: target.tagName.toLowerCase(),
      selector: cssPath(target),
      text: (target.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
      source,
      ...classTokens(target),
    }
    let staged = this.items.find((change) => sameElement(change.element, element))

    if (staged === undefined) {
      const effective = incoming.filter((edit) => edit.from !== edit.to).map((edit) => ({ ...edit }))
      if (effective.length === 0) {
        for (const edit of incoming) {
          const property = this.editProperty(edit.property)
          if (property !== undefined) restoreBaselineProperty(target, baseline, property)
        }
        return false
      }
      staged = {
        element,
        edits: effective,
        selectionGroups: selectionGroup === undefined ? [] : [{ ...selectionGroup }],
        target,
        restore: { ...baseline.inlineStyles },
      }
      this.items.push(staged)
    } else {
      this.addSelectionGroup(staged, selectionGroup)
      for (const edit of incoming) {
        const existingIndex = staged.edits.findIndex((previous) => previous.property === edit.property)
        if (existingIndex === -1) {
          if (edit.from !== edit.to) staged.edits.push({ ...edit })
          continue
        }
        const previous = staged.edits[existingIndex]
        if (previous === undefined) continue
        previous.to = edit.to
        if (previous.from === previous.to) {
          this.restoreProperty(staged, edit.property)
          staged.edits.splice(existingIndex, 1)
        }
      }
    }

    if (staged.edits.length === 0) this.removeItem(staged)
    this.actions.changed()
    if (!this.isEmpty) this.actions.notify('Change added to the pending batch')
    return true
  }

  remove(groupIndex: number, property: string): boolean {
    const change = this.items[groupIndex]
    if (change === undefined) return false
    const editIndex = change.edits.findIndex((edit) => edit.property === property)
    if (editIndex === -1) return false
    this.restoreProperty(change, property)
    change.edits.splice(editIndex, 1)
    if (change.edits.length === 0) this.items.splice(groupIndex, 1)
    this.actions.changed()
    return true
  }

  discard(): void {
    for (const change of this.items) {
      for (const edit of change.edits) this.restoreProperty(change, edit.property)
    }
    this.items.length = 0
    this.actions.changed()
  }

  clear(): void {
    this.items.length = 0
  }

  taskChanges(): VisdiffTaskChange[] {
    return this.items.flatMap((group) => {
      const edits: EditList = group.edits.map((edit) => ({ ...edit }))
      if (edits.length === 0) return []
      return [{
        element: group.element,
        edits,
        ...(group.selectionGroups.length > 0
          ? { selectionGroups: group.selectionGroups.map((selectionGroup) => ({ ...selectionGroup })) }
          : {}),
      }]
    })
  }

  private addSelectionGroup(change: StagedChange, selectionGroup: VisdiffSelectionGroup | undefined): void {
    if (selectionGroup === undefined) return
    const existing = change.selectionGroups.find((group) => group.id === selectionGroup.id)
    if (existing === undefined) {
      change.selectionGroups.push({ ...selectionGroup })
      return
    }
    existing.selectedCount = selectionGroup.selectedCount
    existing.role = selectionGroup.role
  }

  private editProperty(property: string): EditProp | undefined {
    return EDIT_PROPERTIES.find((candidate) => candidate === property)
  }

  private restoreProperty(change: StagedChange, property: string): void {
    const editProperty = this.editProperty(property)
    if (editProperty === undefined) return
    const snapshot = change.restore[editProperty]
    if (snapshot !== undefined) {
      restoreInlineStyle(change.target, property, snapshot.value, snapshot.priority)
    }
  }

  private removeItem(change: StagedChange): void {
    const index = this.items.indexOf(change)
    if (index !== -1) this.items.splice(index, 1)
  }
}
