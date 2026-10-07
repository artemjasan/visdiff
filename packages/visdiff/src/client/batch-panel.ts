import type { StagedChange } from './model'
import type { VisdiffEdit } from '../types'
import {
  renderPendingChanges,
  type BatchViewActions,
  type BatchViewState,
  type OverlayElements,
} from './overlay'

type OverlayProvider = () => OverlayElements | null

export interface BatchPanelActions {
  changes(): StagedChange[]
  state(): Omit<BatchViewState, 'hidden'>
  apply(): void
  clear(): void
  removeChange(groupIndex: number, property: string): void
}

export class BatchPanelController {
  private hidden = false

  constructor(
    private readonly getOverlay: OverlayProvider,
    private readonly actions: BatchPanelActions,
  ) {}

  render(): void {
    const ui = this.getOverlay()
    if (ui === null) return
    const changes = this.actions.changes()
    if (changes.length === 0) this.hidden = false
    const state: BatchViewState = { ...this.actions.state(), hidden: this.hidden }
    const viewActions: BatchViewActions = {
      editComment: this.openCommentEditor,
      removeChange: (groupIndex, property) => this.actions.removeChange(groupIndex, property),
    }
    renderPendingChanges(ui, changes, state, viewActions)
  }

  hide(): void {
    const ui = this.getOverlay()
    if (ui === null || this.actions.changes().length === 0) return
    const rect = ui.batchPanel.getBoundingClientRect()
    const maxLeft = Math.max(0, window.innerWidth - 150)
    const maxTop = Math.max(0, window.innerHeight - 38)
    ui.batchRestoreBtn.style.left = `${Math.min(Math.max(rect.left, 0), maxLeft)}px`
    ui.batchRestoreBtn.style.top = `${Math.min(Math.max(rect.top, 0), maxTop)}px`
    ui.batchRestoreBtn.style.right = 'auto'
    ui.batchRestoreBtn.style.bottom = 'auto'
    this.hidden = true
    this.render()
  }

  show(): void {
    const ui = this.getOverlay()
    if (ui === null) return
    const rect = ui.batchRestoreBtn.getBoundingClientRect()
    ui.batchPanel.style.left = `${rect.left}px`
    ui.batchPanel.style.top = `${rect.top}px`
    ui.batchPanel.style.right = 'auto'
    ui.batchPanel.style.bottom = 'auto'
    this.hidden = false
    this.render()
    this.clamp()
  }

  clamp(): void {
    const ui = this.getOverlay()
    if (ui === null) return
    const panel = this.hidden ? ui.batchRestoreBtn : ui.batchPanel
    if (panel.style.display === 'none') return
    const rect = panel.getBoundingClientRect()
    const maxLeft = Math.max(0, window.innerWidth - rect.width)
    const maxTop = Math.max(0, window.innerHeight - rect.height)
    panel.style.left = `${Math.min(Math.max(rect.left, 0), maxLeft)}px`
    panel.style.top = `${Math.min(Math.max(rect.top, 0), maxTop)}px`
    panel.style.right = 'auto'
    panel.style.bottom = 'auto'
  }

  startDrag(event: PointerEvent): void {
    const ui = this.getOverlay()
    if (ui === null || this.actions.state().applying || this.hidden) return
    const target = event.target
    if (target instanceof Element && target.closest('button') !== null) return
    event.preventDefault()
    event.stopPropagation()

    const rect = ui.batchPanel.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const pointerId = event.pointerId
    ui.batchPanel.style.left = `${rect.left}px`
    ui.batchPanel.style.top = `${rect.top}px`
    ui.batchPanel.style.right = 'auto'
    ui.batchPanel.style.bottom = 'auto'

    const onMove = (move: PointerEvent): void => {
      if (move.pointerId !== pointerId) return
      const maxLeft = Math.max(0, window.innerWidth - rect.width)
      const maxTop = Math.max(0, window.innerHeight - rect.height)
      const left = Math.min(Math.max(rect.left + move.clientX - startX, 0), maxLeft)
      const top = Math.min(Math.max(rect.top + move.clientY - startY, 0), maxTop)
      ui.batchPanel.style.left = `${left}px`
      ui.batchPanel.style.top = `${top}px`
    }
    const onUp = (up: PointerEvent): void => {
      if (up.pointerId !== pointerId) return
      document.removeEventListener('pointermove', onMove, true)
      document.removeEventListener('pointerup', onUp, true)
      document.removeEventListener('pointercancel', onUp, true)
    }
    document.addEventListener('pointermove', onMove, true)
    document.addEventListener('pointerup', onUp, true)
    document.addEventListener('pointercancel', onUp, true)
  }

  private readonly openCommentEditor = (groupIndex: number, edit: VisdiffEdit): void => {
    const ui = this.getOverlay()
    if (ui === null) return
    const field = ui.commentField
    field.value = edit.note ?? ''
    ui.commentSaveBtn.onclick = () => {
      const trimmed = field.value.trim()
      if (trimmed.length > 0) edit.note = trimmed
      else delete edit.note
      this.hideCommentEditor()
      this.render()
    }
    ui.commentCancelBtn.onclick = this.hideCommentEditor
    const row = ui.batchList.querySelectorAll('[data-vd-change]')[groupIndex]
    const rect = row instanceof Element ? row.getBoundingClientRect() : undefined
    ui.commentEditor.style.left = `${rect ? rect.left : 24}px`
    ui.commentEditor.style.top = `${rect ? rect.top + rect.height + 8 : 80}px`
    ui.commentEditor.style.display = 'block'
    field.focus()
  }

  private readonly hideCommentEditor = (): void => {
    const ui = this.getOverlay()
    if (ui !== null) ui.commentEditor.style.display = 'none'
  }
}
