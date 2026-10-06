/**
 * Browser overlay: pick an element, adjust it visually, and stage each completed gesture.
 * The transparent change panel lists queued edits and submits the entire batch on Apply.
 */
import {
  composeMoveTransform,
  currentEditList,
  EDIT_PROPERTIES,
  sameElement,
  type DragMode,
  type EditList,
  type EditProp,
  type EditRecord,
  type ElementBaseline,
  type InlineStyleSnapshot,
  type LayoutProp,
  type SourceInfo,
  type StagedChange,
} from './client/model'
import { cssPath, describe, resolveElementSource, sourceSync } from './client/source'
import {
  createOverlay,
  renderPendingChanges as renderOverlayPendingChanges,
  showToast,
  updateLayoutPanel,
  type OverlayElements,
} from './client/overlay'
import type { VisdiffEdit, VisdiffTaskChange, VisdiffTaskElement } from './types'


interface VisdiffApi {
  enter(): void
  exit(): void
  toggle(): void
  select(target: string | Element): void
  save(): void
}

declare global {
  interface Window {
    __visdiff?: VisdiffApi
  }
}

function isSystemUiElement(target: Element): boolean {
  return target.closest('[data-vd-ui]') !== null
}

/* ------------------------------------------------------------------ endpoint */
function computeEndpoint(): string {
  const script = document.currentScript as HTMLScriptElement | null
  const src = script?.src ?? ''
  try {
    if (src.length > 0) {
      const url = new URL(src, location.href)
      if (url.pathname.endsWith('/client.js')) {
        url.pathname = url.pathname.slice(0, -'/client.js'.length)
      }
      return `${url.origin}${url.pathname.replace(/\/$/, '')}`
    }
  } catch {
    /* fall through to same-origin default */
  }
  return `${location.origin}/__visdiff`
}

const ENDPOINT = typeof document === 'undefined' ? '' : computeEndpoint()

/* --------------------------------------------------------------------- state */
let running = false
let selected: HTMLElement | SVGElement | null = null
let selectedGroup: Array<HTMLElement | SVGElement> = []
let hovered: Element | null = null
let hoverSrc: SourceInfo | null = null
let source: SourceInfo | null = null
let baseline: ElementBaseline | null = null
let edits: Partial<Record<EditProp, EditRecord>> | null = null
let applying = false
let pendingChanges: StagedChange[] = []
let batchPanelHidden = false
let selectSeq = 0
let layoutTarget: HTMLElement | null = null
let layoutBaseline: ElementBaseline | null = null
let layoutEdits: Partial<Record<EditProp, EditRecord>> = {}

let overlay: OverlayElements | null = null

/* --------------------------------------------------------------------- modes */
function enter(): void {
  if (running || overlay === null) return
  running = true
  document.body.classList.add('vd-on')
  renderPendingChanges()
  requestAnimationFrame(tick)
}

function exit(): void {
  if (!running) return
  if (hasEdits() || hasLayoutEdits()) stageCurrentChange()
  deselect()
  hoverBlur()
  running = false
  document.body.classList.remove('vd-on')
  renderPendingChanges()
}

function toggle(): void {
  if (running) exit()
  else enter()
}

function deselect(): void {
  if (hasLayoutEdits()) resetLayoutPreview()
  selected = null
  selectedGroup = []
  baseline = null
  edits = null
  source = null
  layoutTarget = null
  layoutBaseline = null
  layoutEdits = {}
  refreshLayoutPanel()
  for (const node of [overlay?.selFrame, overlay?.handleE, overlay?.handleS, overlay?.handleSE, overlay?.bar]) {
    if (node !== undefined) node.style.display = 'none'
  }
}

function activeTargets(): Array<HTMLElement | SVGElement> {
  if (selected === null) return selectedGroup
  if (selectedGroup.length === 0) return [selected]
  return selectedGroup.includes(selected) ? selectedGroup : [selected]
}

function hasEdits(): boolean {
  if (edits === null) return false
  const currentEdits = edits
  return EDIT_PROPERTIES.some((property) => currentEdits[property] !== undefined)
}

function hasLayoutEdits(): boolean {
  return Object.keys(layoutEdits).length > 0
}

function cancelSelection(): void {
  if (hasEdits()) resetOverrides(false)
  deselect()
}

function hoverBlur(): void {
  hovered = null
  hoverSrc = null
  if (overlay !== null) {
    overlay.frame.style.display = 'none'
    overlay.badge.style.display = 'none'
  }
}

/* ----------------------------------------------------------------- selection */
function readBaseline(el: HTMLElement | SVGElement): ElementBaseline {
  const computed = getComputedStyle(el)
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
      value: el.style.getPropertyValue(property),
      priority: el.style.getPropertyPriority(property),
    }
  }
  return {
    cssWidth: computed.width,
    cssHeight: computed.height,
    widthExtras,
    heightExtras,
    borderBox: computed.boxSizing === 'border-box',
    transform: computed.transform,
    inlineStyles,
  }
}

function readStyleValue(el: HTMLElement | SVGElement, property: EditProp): string {
  return getComputedStyle(el).getPropertyValue(property).trim()
}

function select(target: Element, additive = false): void {
  if (applying || isSystemUiElement(target)) return
  if (!(target instanceof HTMLElement) && !(target instanceof SVGElement)) return
  const active = target as HTMLElement | SVGElement
  const groupBefore = additive ? [...selectedGroup] : []
  if (selected !== null && (hasEdits() || hasLayoutEdits())) {
    if (selected === active && !additive) return
    stageCurrentChange()
  }
  const seq = ++selectSeq
  deselect()
  hoverBlur()
  if (additive) {
    const next = groupBefore.includes(active)
      ? groupBefore.filter((item) => item !== active)
      : [...groupBefore, active]
    selectedGroup = next
    if (selectedGroup.length === 0) {
      deselect()
      return
    }
    const nextSelected = selectedGroup.at(-1)
    if (nextSelected === undefined) return
    selected = nextSelected
  } else {
    selectedGroup = [active]
    selected = active
  }
  baseline = readBaseline(selected)
  edits = {}
  const sync = sourceSync(selected)
  updateSelectionLabel(selected, sync, sync === null)
  if (sync !== null) source = sync
  if (overlay !== null) {
    overlay.bar.style.display = 'flex'
    positionBar(selected.getBoundingClientRect())
  }
  refreshLayoutPanel()
  void resolveAsync(selected, seq)
}

function updateSelectionLabel(target: Element, sourceInfo: SourceInfo | null, resolving = false): void {
  const label = overlay?.barLabel
  if (label === undefined) return
  if (selectedGroup.length > 1) {
    label.textContent = `${selectedGroup.length} elements selected`
    return
  }
  label.textContent = resolving ? 'Resolving source…' : describe(target, sourceInfo)
}

function selectedLayoutContainer(): HTMLElement | null {
  if (selectedGroup.length < 2) return null
  const first = selectedGroup[0]
  const parent = first?.parentElement
  if (!(parent instanceof HTMLElement)) return null
  return selectedGroup.every((target) => target.parentElement === parent) ? parent : null
}

function refreshLayoutPanel(): void {
  if (overlay === null) return
  const nextTarget = selectedLayoutContainer()
  if (nextTarget !== layoutTarget) {
    layoutTarget = nextTarget
    layoutBaseline = layoutTarget === null ? null : readBaseline(layoutTarget)
    layoutEdits = {}
  }
  if (nextTarget === null) {
    layoutBaseline = null
    updateLayoutPanel(overlay, selectedGroup.length, null, '')
    return
  }
  updateLayoutPanel(overlay, selectedGroup.length, nextTarget, describe(nextTarget, sourceSync(nextTarget)))
}

function applyLayout(property: LayoutProp, value: string): void {
  const target = layoutTarget
  if (applying || target === null) return
  layoutBaseline ??= readBaseline(target)
  if (property !== 'display') {
    const display = readStyleValue(target, 'display')
    if (display !== 'flex' && display !== 'inline-flex' && display !== 'grid' && display !== 'inline-grid') {
      target.style.setProperty('display', 'flex', 'important')
      keepRecord(layoutEdits, 'display', display, 'flex', 'style')
    }
  }
  const from = readStyleValue(target, property)
  if (from === value) return
  target.style.setProperty(property, value, 'important')
  keepRecord(layoutEdits, property, from, value, 'style')
  refreshLayoutPanel()
  toast(`Previewing ${property}: ${value}`, false)
}

function resetLayoutPreview(): void {
  const target = layoutTarget
  const original = layoutBaseline
  if (target !== null && original !== null) {
    for (const property of EDIT_PROPERTIES) {
      if (layoutEdits[property] !== undefined) restoreBaselineProperty(target, original, property)
    }
    layoutBaseline = readBaseline(target)
  }
  layoutEdits = {}
  refreshLayoutPanel()
}

function stageLayoutChange(): boolean {
  if (layoutTarget === null || layoutBaseline === null || !hasLayoutEdits()) return false
  const staged = stageTargetChange(layoutTarget, layoutBaseline, sourceSync(layoutTarget), layoutEdits)
  layoutEdits = {}
  layoutBaseline = readBaseline(layoutTarget)
  refreshLayoutPanel()
  return staged
}

async function resolveAsync(el: Element, seq: number): Promise<void> {
  try {
    const info = await resolveElementSource(el)
    if (seq !== selectSeq || selected !== el) return
    if (info !== null && typeof info.filePath === 'string') {
      source = {
        file: info.filePath,
        line: typeof info.lineNumber === 'number' ? info.lineNumber : undefined,
        column: typeof info.columnNumber === 'number' ? info.columnNumber : undefined,
        component: typeof info.componentName === 'string' ? info.componentName : undefined,
      }
      updateSelectionLabel(el, source)
    } else if (source === null && overlay !== null) {
      updateSelectionLabel(el, null)
      if (selectedGroup.length === 1) overlay.barLabel.textContent += ' (no source)'
    }
  } catch {
    if (seq === selectSeq && selected === el && source === null && overlay !== null) {
      updateSelectionLabel(el, null)
      if (selectedGroup.length === 1) overlay.barLabel.textContent += ' (no source)'
    }
  }
}

/* ------------------------------------------------------------------- editing */
function keepRecord(targetEdits: Partial<Record<EditProp, EditRecord>> | null, prop: EditProp, from: string, to: string, kind: 'move' | 'resize' | 'style'): void {
  if (targetEdits === null) return
  const prev = targetEdits[prop]
  if (prev !== undefined) {
    prev.to = to
    return
  }
  targetEdits[prop] = { property: prop, from, to, kind }
}

function keepRecordLocal(prop: EditProp, from: string, to: string, kind: 'move' | 'resize' | 'style'): void {
  keepRecord(edits, prop, from, to, kind)
}

function startDrag(ev: PointerEvent, mode: DragMode): void {
  const targets = activeTargets()
  if (applying || targets.length === 0) return
  ev.preventDefault()
  ev.stopPropagation()

  const records = new Map<HTMLElement | SVGElement, { baseline: ElementBaseline; edits: Partial<Record<EditProp, EditRecord>>; source: SourceInfo | null }>()
  for (const target of targets) {
    records.set(target, {
      baseline: readBaseline(target),
      edits: {},
      source: sourceSync(target),
    })
  }

  const startX = ev.clientX
  const startY = ev.clientY
  const dragRects = new Map<HTMLElement | SVGElement, DOMRect>()
  for (const target of targets) {
    dragRects.set(target, target.getBoundingClientRect())
  }

  const onMove = (e: PointerEvent): void => {
    const dx = Math.round(e.clientX - startX)
    const dy = Math.round(e.clientY - startY)
    if (dx === 0 && dy === 0) return
    for (const target of targets) {
      const record = records.get(target)
      if (record === undefined) continue
      const base = record.baseline
      const gestureRect = dragRects.get(target) ?? target.getBoundingClientRect()
      if (mode === 'move') {
        const to = composeMoveTransform(base.transform, dx, dy)
        target.style.setProperty('transform', to, 'important')
        keepRecord(record.edits, 'transform', base.transform, to, 'move')
      }
      if (mode === 'w' || mode === 'wh') {
        const outerWidth = Math.max(8, Math.round(gestureRect.width + dx))
        const cssWidth = base.borderBox ? outerWidth : Math.max(0, outerWidth - base.widthExtras)
        const to = `${cssWidth}px`
        target.style.setProperty('width', to, 'important')
        keepRecord(record.edits, 'width', base.cssWidth, to, 'resize')
      }
      if (mode === 'h' || mode === 'wh') {
        const outerHeight = Math.max(8, Math.round(gestureRect.height + dy))
        const cssHeight = base.borderBox ? outerHeight : Math.max(0, outerHeight - base.heightExtras)
        const to = `${cssHeight}px`
        target.style.setProperty('height', to, 'important')
        keepRecord(record.edits, 'height', base.cssHeight, to, 'resize')
      }
    }
  }

  const commit = (): void => {
    for (const [target, record] of records) {
      const incoming = currentEditList(record.edits)
      if (incoming.length === 0) continue
      const targetSource = record.source
      const targetBaseline = record.baseline
      const targetEdits = record.edits
      const content = stageTargetChange(target, targetBaseline, targetSource, targetEdits)
      if (content) {
        if (selected === target) {
          baseline = readBaseline(target)
          edits = {}
          source = sourceSync(target)
        }
      }
    }
    if (selectedGroup.length > 1) {
      deselect()
    }
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

function restoreInlineStyle(el: HTMLElement | SVGElement, property: string, value: string, priority: string): void {
  if (value.length === 0) el.style.removeProperty(property)
  else el.style.setProperty(property, value, priority)
}

function restoreBaselineProperty(el: HTMLElement | SVGElement, baseline: ElementBaseline, property: EditProp): void {
  const snapshot = baseline.inlineStyles[property]
  if (snapshot === undefined) return
  restoreInlineStyle(el, property, snapshot.value, snapshot.priority)
}

function resetOverrides(notify = true): void {
  let changed = false
  if (selected !== null && edits !== null && baseline !== null) {
    for (const property of EDIT_PROPERTIES) {
      if (edits[property] === undefined) continue
      restoreBaselineProperty(selected, baseline, property)
      changed = true
    }
    edits = {}
    baseline = readBaseline(selected)
  }
  if (hasLayoutEdits()) {
    resetLayoutPreview()
    changed = true
  }
  if (!changed) return
  if (notify) toast('Overrides cleared', false)
}

function restoreStagedProperty(change: StagedChange, property: string): void {
  const editProperty = EDIT_PROPERTIES.find((candidate) => candidate === property)
  if (editProperty === undefined) return
  const snapshot = change.restore[editProperty]
  if (snapshot !== undefined) restoreInlineStyle(change.target, property, snapshot.value, snapshot.priority)
}

function stageTargetChange(
  target: HTMLElement | SVGElement,
  targetBaseline: ElementBaseline,
  targetSource: SourceInfo | null,
  targetEdits: Partial<Record<EditProp, EditRecord>>,
): boolean {
  const incoming = currentEditList(targetEdits)
  if (incoming.length === 0) return false
  const element: VisdiffTaskElement = {
    tag: target.tagName.toLowerCase(),
    selector: cssPath(target),
    text: (target.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
    source: targetSource,
  }
  let staged: StagedChange | undefined
  for (const candidate of pendingChanges) {
    if (sameElement(candidate.element, element)) {
      staged = candidate
      break
    }
  }
  if (staged === undefined) {
    const effective: EditList = []
    for (const edit of incoming) {
      if (edit.from !== edit.to) effective.push({ ...edit })
    }
    if (effective.length === 0) {
      for (const edit of incoming) {
        const property = EDIT_PROPERTIES.find((candidate) => candidate === edit.property)
        if (property !== undefined) restoreBaselineProperty(target, targetBaseline, property)
      }
      return false
    }
    staged = {
      element,
      edits: effective,
      target,
      restore: { ...targetBaseline.inlineStyles },
    }
    pendingChanges.push(staged)
  } else {
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
        restoreStagedProperty(staged, edit.property)
        staged.edits.splice(existingIndex, 1)
      }
    }
  }
  if (staged.edits.length === 0) {
    const stagedIndex = pendingChanges.indexOf(staged)
    if (stagedIndex !== -1) pendingChanges.splice(stagedIndex, 1)
  }
  renderPendingChanges()
  if (pendingChanges.length > 0) toast('Change added to the pending batch', false)
  return true
}

function stageCurrentChange(): boolean {
  if (applying) return false
  let staged = false
  if (selected !== null && baseline !== null && edits !== null && hasEdits()) {
    staged = stageTargetChange(selected, baseline, source, edits) || staged
  }
  staged = stageLayoutChange() || staged
  deselect()
  return staged
}

function removeStagedChange(groupIndex: number, property: string): void {
  if (applying) return
  const group = pendingChanges[groupIndex]
  if (group === undefined) return
  const editIndex = group.edits.findIndex((edit) => edit.property === property)
  if (editIndex === -1) return
  restoreStagedProperty(group, property)
  group.edits.splice(editIndex, 1)
  if (group.edits.length === 0) pendingChanges.splice(groupIndex, 1)
  renderPendingChanges()
}

function discardPendingChanges(): void {
  if (applying) return
  if (hasEdits() || hasLayoutEdits()) resetOverrides(false)
  for (const group of pendingChanges) {
    for (const edit of group.edits) restoreStagedProperty(group, edit.property)
  }
  pendingChanges = []
  deselect()
  renderPendingChanges()
  toast('Pending changes discarded', false)
}

function openCommentEditor(groupIndex: number, edit: VisdiffEdit): void {
  const ui = overlay
  if (ui === null) return
  const field = ui.commentField
  field.value = edit.note ?? ''
  ui.commentSaveBtn.onclick = () => {
    const trimmed = field.value.trim()
    if (trimmed.length > 0) edit.note = trimmed
    else delete edit.note
    hideCommentEditor()
    renderPendingChanges()
  }
  ui.commentCancelBtn.onclick = () => {
    hideCommentEditor()
  }
  const row = ui.batchList.querySelectorAll('[data-vd-change]')[groupIndex]
  const rect = row instanceof Element ? row.getBoundingClientRect() : undefined
  ui.commentEditor.style.left = `${rect ? rect.left : 24}px`
  ui.commentEditor.style.top = `${rect ? rect.top + rect.height + 8 : 80}px`
  ui.commentEditor.style.display = 'block'
  field.focus()
}

function hideCommentEditor(): void {
  if (overlay !== null) overlay.commentEditor.style.display = 'none'
}

function renderPendingChanges(): void {
  const ui = overlay
  if (ui === null) return
  if (pendingChanges.length === 0) batchPanelHidden = false
  renderOverlayPendingChanges(
    ui,
    pendingChanges,
    {
      running,
      applying,
      hidden: batchPanelHidden,
    },
    {
      editComment: openCommentEditor,
      removeChange: removeStagedChange,
    },
  )
}

function hideBatchPanel(): void {
  const ui = overlay
  if (ui === null || pendingChanges.length === 0) return
  const rect = ui.batchPanel.getBoundingClientRect()
  const maxLeft = Math.max(0, window.innerWidth - 150)
  const maxTop = Math.max(0, window.innerHeight - 38)
  ui.batchRestoreBtn.style.left = `${Math.min(Math.max(rect.left, 0), maxLeft)}px`
  ui.batchRestoreBtn.style.top = `${Math.min(Math.max(rect.top, 0), maxTop)}px`
  ui.batchRestoreBtn.style.right = 'auto'
  ui.batchRestoreBtn.style.bottom = 'auto'
  batchPanelHidden = true
  renderPendingChanges()
}

function showBatchPanel(): void {
  const ui = overlay
  if (ui === null) return
  const rect = ui.batchRestoreBtn.getBoundingClientRect()
  ui.batchPanel.style.left = `${rect.left}px`
  ui.batchPanel.style.top = `${rect.top}px`
  ui.batchPanel.style.right = 'auto'
  ui.batchPanel.style.bottom = 'auto'
  batchPanelHidden = false
  renderPendingChanges()
  clampBatchPanel()
}

function clampBatchPanel(): void {
  const ui = overlay
  if (ui === null) return
  const panel = batchPanelHidden ? ui.batchRestoreBtn : ui.batchPanel
  if (panel.style.display === 'none') return
  const rect = panel.getBoundingClientRect()
  const maxLeft = Math.max(0, window.innerWidth - rect.width)
  const maxTop = Math.max(0, window.innerHeight - rect.height)
  panel.style.left = `${Math.min(Math.max(rect.left, 0), maxLeft)}px`
  panel.style.top = `${Math.min(Math.max(rect.top, 0), maxTop)}px`
  panel.style.right = 'auto'
  panel.style.bottom = 'auto'
}

function startBatchPanelDrag(ev: PointerEvent): void {
  const ui = overlay
  if (applying || ui === null || batchPanelHidden) return
  const target = ev.target
  if (target instanceof Element && target.closest('button') !== null) return
  ev.preventDefault()
  ev.stopPropagation()
  const rect = ui.batchPanel.getBoundingClientRect()
  const startX = ev.clientX
  const startY = ev.clientY
  const pointerId = ev.pointerId
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
  const onUp = (end: PointerEvent): void => {
    if (end.pointerId !== pointerId) return
    document.removeEventListener('pointermove', onMove, true)
    document.removeEventListener('pointerup', onUp, true)
    document.removeEventListener('pointercancel', onUp, true)
  }
  document.addEventListener('pointermove', onMove, true)
  document.addEventListener('pointerup', onUp, true)
  document.addEventListener('pointercancel', onUp, true)
}

async function save(): Promise<void> {
  if (applying) return
  if (hasEdits() || hasLayoutEdits()) stageCurrentChange()
  if (pendingChanges.length === 0) {
    toast('No pending visual changes', false)
    return
  }
  const changes: VisdiffTaskChange[] = []
  for (const group of pendingChanges) {
    const editList: EditList = []
    for (const edit of group.edits) {
      editList.push({ property: edit.property, from: edit.from, to: edit.to, kind: edit.kind })
    }
    if (editList.length > 0) changes.push({ element: group.element, edits: editList })
  }
  if (changes.length === 0) {
    toast('No pending visual changes', false)
    return
  }
  const note = overlay?.batchNoteField.value.trim() ?? ''
  const payload = {
    url: location.href,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    changes: changes.map((change) => ({
      ...change,
      edits: change.edits.map((edit) => {
        const next = { ...edit }
        const trimmedNote = edit.note?.trim() ?? ''
        if (trimmedNote.length > 0) next.note = trimmedNote
        else delete next.note
        return next
      }),
    })),
    ...(note.length > 0 ? { note } : {}),
  }
  applying = true
  renderPendingChanges()
  try {
    const res = await fetch(`${ENDPOINT}/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    pendingChanges = []
    renderPendingChanges()
    toast(`Batch queued with ${changes.length} element(s)`, false)
  } catch (err) {
    console.error('[visdiff] save failed', err)
    toast('Save failed — changes remain in the panel', true)
  } finally {
    applying = false
    renderPendingChanges()
  }
}

/* -------------------------------------------------------------- interaction */
function onHover(ev: MouseEvent): void {
  if (!running || selected !== null) return
  const target = ev.target
  if (!(target instanceof Element) || isSystemUiElement(target) || !document.contains(target)) {
    hoverBlur()
    return
  }
  if (target === hovered) return
  hovered = target
  hoverSrc = sourceSync(target)
  const rect = target.getBoundingClientRect()
  if (overlay !== null) {
    setBox(overlay.frame, rect)
    overlay.badge.textContent = describe(target, hoverSrc)
    overlay.badge.style.display = 'block'
    overlay.badge.style.left = `${Math.max(rect.left, 8)}px`
    overlay.badge.style.top = `${Math.max(rect.top - 24, 4)}px`
  }
}

function onPointerDown(ev: PointerEvent): void {
  if (!running || applying) return
  const target = ev.target
  if (!(target instanceof HTMLElement) && !(target instanceof SVGElement)) return
  if (isSystemUiElement(target)) return
  ev.preventDefault()
  ev.stopPropagation()
  if (ev.shiftKey) {
    select(target, true)
    return
  }
  const isSelectedTarget = selectedGroup.some((item) => item === target || item.contains(target))
  if (selected !== null && isSelectedTarget) {
    startDrag(ev, 'move')
    return
  }
  select(target)
}

function onKey(ev: KeyboardEvent): void {
  if (!running || ev.key !== 'Escape') return
  if (selected !== null) cancelSelection()
  else exit()
}

/* ----------------------------------------------------------------- geometry */
function setBox(node: HTMLElement, rect: DOMRect): void {
  node.style.display = 'block'
  node.style.left = `${rect.left}px`
  node.style.top = `${rect.top}px`
  node.style.width = `${rect.width}px`
  node.style.height = `${rect.height}px`
}

function positionBar(rect: DOMRect): void {
  const bar = overlay?.bar
  if (bar === undefined) return
  const left = Math.min(Math.max(rect.left, 8), Math.max(window.innerWidth - bar.offsetWidth - 8, 8))
  const nearTop = rect.top >= 46
  bar.style.left = `${left}px`
  bar.style.top = `${nearTop ? rect.top - 42 : rect.bottom + 6}px`
  positionLayoutPanel()
}

function positionLayoutPanel(): void {
  const ui = overlay
  if (ui === null || ui.layoutPanel.style.display === 'none') return
  const anchor = ui.layoutToggleBtn.getBoundingClientRect()
  const panel = ui.layoutPanel.getBoundingClientRect()
  const left = Math.min(
    Math.max(anchor.right - panel.width, 8),
    Math.max(window.innerWidth - panel.width - 8, 8),
  )
  const below = anchor.bottom + panel.height + 8 <= window.innerHeight - 8
  const top = below ? anchor.bottom + 8 : anchor.top - panel.height - 8
  ui.layoutPanel.style.left = `${left}px`
  ui.layoutPanel.style.top = `${Math.min(Math.max(top, 8), Math.max(window.innerHeight - panel.height - 8, 8))}px`
}

function positionSelection(): void {
  const ui = overlay
  if (selected === null || ui === null) return
  if (!document.contains(selected)) {
    // Preserve the visual edit in the batch even if HMR swaps its DOM node.
    stageCurrentChange()
    return
  }
  const rect = selected.getBoundingClientRect()
  setBox(ui.selFrame, rect)
  ui.handleE.style.display = 'block'
  ui.handleE.style.left = `${rect.right - 6}px`
  ui.handleE.style.top = `${rect.top + rect.height / 2 - 6}px`
  ui.handleS.style.display = 'block'
  ui.handleS.style.left = `${rect.left + rect.width / 2 - 6}px`
  ui.handleS.style.top = `${rect.bottom - 6}px`
  ui.handleSE.style.display = 'block'
  ui.handleSE.style.left = `${rect.right - 6}px`
  ui.handleSE.style.top = `${rect.bottom - 6}px`
  positionBar(rect)
}

function tick(): void {
  if (!running) return
  if (selected !== null) {
    positionSelection()
  } else if (hovered !== null && document.contains(hovered)) {
    const rect = hovered.getBoundingClientRect()
    if (overlay !== null) setBox(overlay.frame, rect)
  }
  requestAnimationFrame(tick)
}

/* ---------------------------------------------------------------- feed-face */
function toast(message: string, isError: boolean): void {
  if (overlay !== null) showToast(overlay, message, isError)
}

/* ---------------------------------------------------------------- mount ---- */
function mountUI(): void {
  overlay = createOverlay({
    toggle,
    reset: () => resetOverrides(),
    cancelSelection,
    startDrag,
    startPanelDrag: startBatchPanelDrag,
    hideBatchPanel,
    showBatchPanel,
    apply: () => { void save() },
    clear: discardPendingChanges,
    applyLayout,
    positionLayoutPanel,
  })

  document.addEventListener('mousemove', onHover, true)
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKey, true)
  window.addEventListener('resize', clampBatchPanel)
  renderPendingChanges()
}

if (typeof window !== 'undefined' && window.__visdiff === undefined) {
  const api: VisdiffApi = {
    enter,
    exit,
    toggle,
    save(): void {
      void save()
    },
    select(target): void {
      const el = typeof target === 'string' ? document.querySelector(target) : target
      if (el !== null) {
        enter()
        select(el)
      }
    },
  }
  window.__visdiff = api
  const boot = (): void => {
    mountUI()
    requestAnimationFrame(tick)
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true })
  } else {
    boot()
  }
}
