import { CSS_STYLES } from './styles'
import type { LayoutProp, StagedChange } from './model'
import type { VisdiffEdit } from '../types'

export interface OverlayElements {
  btn: HTMLButtonElement
  frame: HTMLDivElement
  badge: HTMLDivElement
  selFrame: HTMLDivElement
  selectionFrames: HTMLDivElement[]
  layoutContainerFrame: HTMLDivElement
  bar: HTMLDivElement
  barLabel: HTMLSpanElement
  layoutToggleBtn: HTMLButtonElement
  batchPanel: HTMLDivElement
  batchTitle: HTMLSpanElement
  batchRestoreBtn: HTMLButtonElement
  batchList: HTMLDivElement
  batchNoteField: HTMLTextAreaElement
  layoutPanel: HTMLDivElement
  layoutTargetLabel: HTMLSpanElement
  layoutModeSelect: HTMLSelectElement
  layoutJustifySelect: HTMLSelectElement
  layoutAlignSelect: HTMLSelectElement
  layoutDirectionSelect: HTMLSelectElement
  layoutGapSelect: HTMLSelectElement
  commentEditor: HTMLDivElement
  commentField: HTMLTextAreaElement
  commentSaveBtn: HTMLButtonElement
  commentCancelBtn: HTMLButtonElement
  applyBatchBtn: HTMLButtonElement
  copyBatchBtn: HTMLButtonElement
  handleE: HTMLDivElement
  handleS: HTMLDivElement
  handleSE: HTMLDivElement
  toastEl: HTMLDivElement
}

function createField(labelText: string, control: HTMLSelectElement): HTMLLabelElement {
  const field = document.createElement('label')
  field.setAttribute('data-vd-layout-field', '')
  const label = document.createElement('span')
  label.textContent = labelText
  field.append(label, control)
  return field
}

export interface OverlayActions {
  toggle(): void
  reset(): void
  finishSelection(): void
  startDrag(event: PointerEvent, mode: 'w' | 'h' | 'wh'): void
  startPanelDrag(event: PointerEvent): void
  hideBatchPanel(): void
  showBatchPanel(): void
  apply(): void
  copyPrompt(): void
  clear(): void
  applyLayout(property: LayoutProp, value: string): void
}

export interface BatchViewActions {
  editComment(groupIndex: number, edit: VisdiffEdit): void
  removeChange(groupIndex: number, property: string): void
}

export interface BatchViewState {
  readonly running: boolean
  readonly applying: boolean
  readonly hidden: boolean
}

let toastTimer: number | undefined
let layoutOpen = false

export function createOverlay(actions: OverlayActions): OverlayElements {
  const style = document.createElement('style')
  style.textContent = CSS_STYLES
  document.head.appendChild(style)

  const btn = document.createElement('button')
  btn.id = 'vd-toggle'
  btn.setAttribute('data-vd-ui', '')
  btn.textContent = 'visdiff'
  btn.addEventListener('click', () => actions.toggle())

  const frame = createUiElement('div', 'data-vd-frame')
  const badge = createUiElement('div', 'data-vd-badge')
  const layoutContainerFrame = createUiElement('div', 'data-vd-layout-container')
  const selFrame = createUiElement('div', 'data-vd-selection-member')
  const handleE = makeHandle('w', (event, mode) => actions.startDrag(event, mode))
  const handleS = makeHandle('h', (event, mode) => actions.startDrag(event, mode))
  const handleSE = makeHandle('wh', (event, mode) => actions.startDrag(event, mode))

  const bar = createUiElement('div', 'data-vd-bar')
  const barLabel = document.createElement('span')
  barLabel.setAttribute('data-vd-label', '')
  const layoutToggleBtn = document.createElement('button')
  layoutToggleBtn.setAttribute('data-vd-ui', '')
  layoutToggleBtn.setAttribute('data-vd-layout-toggle', '')
  layoutToggleBtn.title = 'Layout tools'
  layoutToggleBtn.setAttribute('aria-label', 'Layout tools')
  layoutToggleBtn.setAttribute('aria-expanded', 'false')
  const toolsIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  toolsIcon.setAttribute('viewBox', '0 0 24 24')
  toolsIcon.setAttribute('width', '16')
  toolsIcon.setAttribute('height', '16')
  toolsIcon.setAttribute('aria-hidden', 'true')
  toolsIcon.setAttribute('fill', 'none')
  toolsIcon.setAttribute('stroke', 'currentColor')
  toolsIcon.setAttribute('stroke-width', '1.8')
  toolsIcon.setAttribute('stroke-linecap', 'round')
  toolsIcon.setAttribute('stroke-linejoin', 'round')
  for (const d of ['M4 7h9', 'M17 7h3', 'M4 17h3', 'M11 17h9', 'M13 4v6', 'M7 14v6']) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    line.setAttribute('d', d)
    toolsIcon.append(line)
  }
  const firstKnob = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  firstKnob.setAttribute('cx', '15')
  firstKnob.setAttribute('cy', '7')
  firstKnob.setAttribute('r', '2')
  toolsIcon.append(firstKnob)
  const secondKnob = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  secondKnob.setAttribute('cx', '9')
  secondKnob.setAttribute('cy', '17')
  secondKnob.setAttribute('r', '2')
  toolsIcon.append(secondKnob)
  layoutToggleBtn.append(toolsIcon)
  layoutToggleBtn.addEventListener('click', () => {
    layoutOpen = !layoutOpen
    layoutToggleBtn.setAttribute('aria-expanded', String(layoutOpen))
    layoutPanel.style.display = layoutOpen ? 'flex' : 'none'
    bar.toggleAttribute('data-vd-expanded', layoutOpen)
  })
  const resetBtn = document.createElement('button')
  resetBtn.textContent = '↺ Reset'
  resetBtn.addEventListener('click', () => actions.reset())
  const cancelBtn = document.createElement('button')
  cancelBtn.textContent = '✕'
  cancelBtn.setAttribute('aria-label', 'Finish selection')
  cancelBtn.title = 'Finish selection'
  cancelBtn.addEventListener('click', () => actions.finishSelection())
  const barControls = document.createElement('div')
  barControls.setAttribute('data-vd-bar-controls', '')
  barControls.append(barLabel, layoutToggleBtn, resetBtn, cancelBtn)

  const batchPanel = createUiElement('div', 'data-vd-batch')
  const batchHeader = document.createElement('div')
  batchHeader.setAttribute('data-vd-batch-header', '')
  batchHeader.addEventListener('pointerdown', (event) => actions.startPanelDrag(event))
  const batchTitle = document.createElement('span')
  batchTitle.setAttribute('data-vd-batch-title', '')
  const hideBatchBtn = document.createElement('button')
  hideBatchBtn.setAttribute('data-vd-ui', '')
  hideBatchBtn.setAttribute('data-vd-batch-hide', '')
  hideBatchBtn.textContent = 'Hide'
  hideBatchBtn.addEventListener('click', () => actions.hideBatchPanel())
  batchHeader.append(batchTitle, hideBatchBtn)
  const batchList = document.createElement('div')
  batchList.setAttribute('data-vd-change-list', '')
  const batchActions = document.createElement('div')
  batchActions.setAttribute('data-vd-batch-actions', '')
  const applyBatchBtn = document.createElement('button')
  applyBatchBtn.setAttribute('data-vd-apply', '')
  applyBatchBtn.textContent = 'Apply'
  applyBatchBtn.addEventListener('click', () => actions.apply())
  const clearBatchBtn = document.createElement('button')
  clearBatchBtn.textContent = 'Clear'
  clearBatchBtn.addEventListener('click', () => actions.clear())
  const copyBatchBtn = document.createElement('button')
  copyBatchBtn.textContent = 'Copy prompt'
  copyBatchBtn.addEventListener('click', () => actions.copyPrompt())
  batchActions.append(applyBatchBtn, copyBatchBtn, clearBatchBtn)
  const batchNoteField = document.createElement('textarea')
  batchNoteField.setAttribute('data-vd-note', '')
  batchNoteField.setAttribute('data-vd-ui', '')
  batchNoteField.placeholder = 'Optional note for the agent'
  batchNoteField.maxLength = 1000
  batchNoteField.rows = 2
  batchPanel.append(batchHeader, batchList, batchNoteField, batchActions)

  const layoutPanel = createUiElement('div', 'data-vd-layout')
  layoutPanel.style.display = 'none'
  const layoutTitle = document.createElement('strong')
  layoutTitle.textContent = 'Layout container'
  const layoutTargetLabel = document.createElement('span')
  layoutTargetLabel.setAttribute('data-vd-layout-target', '')
  const layoutModeSelect = createSelect('Layout', [
    ['flex', 'Flex'],
    ['grid', 'Grid'],
  ], 'display', (property, value) => actions.applyLayout(property, value))
  const layoutDirectionSelect = createSelect('Direction', [
    ['row', 'Row'],
    ['column', 'Column'],
    ['row-reverse', 'Row reverse'],
    ['column-reverse', 'Column reverse'],
  ], 'flex-direction', (property, value) => actions.applyLayout(property, value))
  const layoutJustifySelect = createSelect('Justify', [
    ['normal', 'Normal'],
    ['start', 'Start'],
    ['end', 'End'],
    ['flex-start', 'Flex start'],
    ['flex-end', 'Flex end'],
    ['center', 'Center'],
    ['space-between', 'Space between'],
    ['space-around', 'Space around'],
    ['space-evenly', 'Space evenly'],
    ['stretch', 'Stretch'],
    ['left', 'Left'],
    ['right', 'Right'],
  ], 'justify-content', (property, value) => actions.applyLayout(property, value))
  const layoutAlignSelect = createSelect('Align', [
    ['normal', 'Normal'],
    ['stretch', 'Stretch'],
    ['start', 'Start'],
    ['end', 'End'],
    ['flex-start', 'Flex start'],
    ['flex-end', 'Flex end'],
    ['center', 'Center'],
    ['baseline', 'Baseline'],
  ], 'align-items', (property, value) => actions.applyLayout(property, value))
  const layoutGapSelect = createSelect('Gap', [
    ['normal', 'Normal'],
    ['0px', 'None'],
    ['4px', '4 px'],
    ['8px', '8 px'],
    ['12px', '12 px'],
    ['16px', '16 px'],
    ['24px', '24 px'],
    ['32px', '32 px'],
  ], 'gap', (property, value) => actions.applyLayout(property, value))
  const layoutControls = document.createElement('div')
  layoutControls.setAttribute('data-vd-layout-controls', '')
  layoutControls.append(
    createField('Mode', layoutModeSelect),
    createField('Direction', layoutDirectionSelect),
    createField('Justify', layoutJustifySelect),
    createField('Align', layoutAlignSelect),
    createField('Gap', layoutGapSelect),
  )
  layoutPanel.append(layoutTitle, layoutTargetLabel, layoutControls)
  bar.append(barControls, layoutPanel)

  const commentEditor = createUiElement('div', 'data-vd-comment-panel')
  commentEditor.style.display = 'none'
  const commentField = document.createElement('textarea')
  commentField.rows = 3
  commentField.maxLength = 400
  commentField.placeholder = 'Add a comment for this row'
  const commentSaveBtn = document.createElement('button')
  commentSaveBtn.textContent = 'Save'
  const commentCancelBtn = document.createElement('button')
  commentCancelBtn.textContent = 'Cancel'
  const commentActions = document.createElement('div')
  commentActions.style.display = 'flex'
  commentActions.style.justifyContent = 'flex-end'
  commentActions.style.gap = '6px'
  commentActions.append(commentCancelBtn, commentSaveBtn)
  commentEditor.append(commentField, commentActions)

  const batchRestoreBtn = document.createElement('button')
  batchRestoreBtn.setAttribute('data-vd-batch-restore', '')
  batchRestoreBtn.setAttribute('data-vd-ui', '')
  batchRestoreBtn.addEventListener('click', () => actions.showBatchPanel())

  const toastEl = createUiElement('div', 'data-vd-toast')

  document.body.append(
    btn,
    frame,
    badge,
    layoutContainerFrame,
    selFrame,
    handleE,
    handleS,
    handleSE,
    bar,
    batchPanel,
    commentEditor,
    batchRestoreBtn,
    toastEl,
  )

  return {
    btn,
    frame,
    badge,
    selFrame,
    selectionFrames: [selFrame],
    layoutContainerFrame,
    bar,
    barLabel,
    layoutToggleBtn,
    batchPanel,
    batchTitle,
    batchRestoreBtn,
    batchList,
    batchNoteField,
    layoutPanel,
    layoutTargetLabel,
    layoutModeSelect,
    layoutJustifySelect,
    layoutAlignSelect,
    layoutDirectionSelect,
    layoutGapSelect,
    commentEditor,
    commentField,
    commentSaveBtn,
    commentCancelBtn,
    applyBatchBtn,
    copyBatchBtn,
    handleE,
    handleS,
    handleSE,
    toastEl,
  }
}

export function ensureSelectionFrames(ui: OverlayElements, count: number): HTMLDivElement[] {
  while (ui.selectionFrames.length < count) {
    const selectionFrame = createUiElement('div', 'data-vd-selection-member')
    document.body.append(selectionFrame)
    ui.selectionFrames.push(selectionFrame)
  }
  for (let index = count; index < ui.selectionFrames.length; index++) {
    const selectionFrame = ui.selectionFrames[index]
    if (selectionFrame !== undefined) selectionFrame.style.display = 'none'
  }
  return ui.selectionFrames.slice(0, count)
}

export function renderPendingChanges(
  ui: OverlayElements,
  pendingChanges: StagedChange[],
  state: BatchViewState,
  actions: BatchViewActions,
): void {
  ui.batchList.replaceChildren()
  let count = 0
  for (let groupIndex = 0; groupIndex < pendingChanges.length; groupIndex++) {
    const group = pendingChanges[groupIndex]
    if (group === undefined) continue
    for (const edit of group.edits) {
      count++
      const source = group.element.source
      const location = source === null
        ? group.element.selector
        : `${source.file}${source.line === undefined ? '' : `:${source.line}`}`
      const row = document.createElement('div')
      row.setAttribute('data-vd-change', '')
      const label = document.createElement('span')
      label.setAttribute('data-vd-change-label', '')
      label.textContent = `${location} · ${edit.property}: ${edit.from} → ${edit.to}`
      const rowActions = document.createElement('div')
      rowActions.style.display = 'flex'
      rowActions.style.alignItems = 'center'
      rowActions.style.gap = '6px'
      if (edit.note) {
        const noteBadge = document.createElement('span')
        noteBadge.textContent = '💬'
        noteBadge.title = edit.note
        rowActions.append(noteBadge)
      }
      const comment = document.createElement('button')
      comment.setAttribute('data-vd-ui', '')
      comment.textContent = edit.note ? '✎' : '💬'
      comment.title = edit.note ? 'Edit comment' : 'Add comment'
      comment.addEventListener('click', (event) => {
        event.stopPropagation()
        actions.editComment(groupIndex, edit)
      })
      const remove = document.createElement('button')
      remove.setAttribute('data-vd-ui', '')
      remove.setAttribute('aria-label', `Remove ${edit.property} change for ${location}`)
      remove.textContent = '×'
      remove.addEventListener('click', () => actions.removeChange(groupIndex, edit.property))
      rowActions.append(comment, remove)
      row.append(label, rowActions)
      ui.batchList.append(row)
    }
  }
  ui.batchTitle.textContent = `${count} pending change${count === 1 ? '' : 's'}`
  ui.batchPanel.style.display = count === 0 || state.hidden ? 'none' : 'flex'
  ui.batchRestoreBtn.textContent = `Show changes (${count})`
  ui.batchRestoreBtn.style.display = count > 0 && state.hidden ? 'block' : 'none'
  ui.applyBatchBtn.disabled = count === 0 || state.applying
  ui.copyBatchBtn.disabled = count === 0 || state.applying
  const countLabel = count === 0 ? '' : ` · ${count}`
  ui.btn.textContent = `visdiff${countLabel}${state.running ? ' ✕' : ''}`
}

export function showToast(ui: OverlayElements, message: string, isError: boolean): void {
  if (toastTimer !== undefined) window.clearTimeout(toastTimer)
  ui.toastEl.textContent = message
  if (isError) ui.toastEl.setAttribute('data-err', '')
  else ui.toastEl.removeAttribute('data-err')
  ui.toastEl.style.display = 'block'
  toastTimer = window.setTimeout(() => {
    ui.toastEl.style.display = 'none'
    toastTimer = undefined
  }, 2600)
}

export function updateLayoutPanel(
  ui: OverlayElements,
  selectionCount: number,
  target: HTMLElement | null,
  targetLabel: string,
): void {
  if (selectionCount < 2) layoutOpen = false
  ui.layoutToggleBtn.style.display = selectionCount > 1 ? 'flex' : 'none'
  ui.layoutToggleBtn.setAttribute('aria-expanded', String(layoutOpen))
  ui.layoutPanel.style.display = selectionCount > 1 && layoutOpen ? 'flex' : 'none'
  ui.bar.toggleAttribute('data-vd-expanded', selectionCount > 1 && layoutOpen)
  ui.layoutTargetLabel.textContent = target === null
    ? `${selectionCount} selected. Select siblings with the same parent to edit their layout.`
    : `${selectionCount} selected · applies to ${targetLabel}`
  const controls = [
    ui.layoutModeSelect,
    ui.layoutDirectionSelect,
    ui.layoutJustifySelect,
    ui.layoutAlignSelect,
    ui.layoutGapSelect,
  ]
  for (const control of controls) control.disabled = target === null
  if (target === null) return

  const computed = getComputedStyle(target)
  ui.layoutModeSelect.value = computed.display === 'grid' || computed.display === 'inline-grid' ? 'grid' : 'flex'
  setSelectValue(ui.layoutDirectionSelect, computed.flexDirection)
  setSelectValue(ui.layoutJustifySelect, computed.justifyContent)
  setSelectValue(ui.layoutAlignSelect, computed.alignItems)
  setSelectValue(ui.layoutGapSelect, computed.gap)
  ui.layoutDirectionSelect.disabled = computed.display === 'grid' || computed.display === 'inline-grid'
}

function createUiElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  ...attributes: string[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName)
  element.setAttribute('data-vd-ui', '')
  for (const attribute of attributes) element.setAttribute(attribute, '')
  return element
}

function makeHandle(
  mode: 'w' | 'h' | 'wh',
  onPointerDown: OverlayActions['startDrag'],
): HTMLDivElement {
  const handle = createUiElement('div', 'data-vd-handle')
  handle.setAttribute('data-mode', mode)
  handle.addEventListener('pointerdown', (event) => onPointerDown(event, mode))
  return handle
}

function createSelect(
  label: string,
  options: Array<[string, string]>,
  property: LayoutProp,
  onChange: OverlayActions['applyLayout'],
): HTMLSelectElement {
  const select = document.createElement('select')
  select.setAttribute('data-vd-ui', '')
  select.setAttribute('aria-label', label)
  for (const [value, text] of options) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = text
    select.append(option)
  }
  select.addEventListener('change', () => onChange(property, select.value))
  return select
}

function setSelectValue(select: HTMLSelectElement, value: string): void {
  if (Array.from(select.options).some((option) => option.value === value)) select.value = value
}
