/** Browser entry point wiring selection, editing, layout, batch, and overlay controllers. */
import {
  EDIT_PROPERTIES,
  type DragMode,
  type EditMap,
  type ElementBaseline,
  type LayoutProp,
  type SourceInfo,
} from './client/model'
import {
  ElementEditor,
  readBaseline,
  restoreBaselineProperty,
} from './client/editing'
import { LayoutEditor } from './client/layout'
import { ChangeBatch } from './client/batch'
import { BatchPanelController } from './client/batch-panel'
import {
  positionBar,
  positionSelection as updateSelectionPosition,
  setBox,
} from './client/geometry'
import { describe, resolveElementSource, sourceSync } from './client/source'
import {
  createOverlay,
  showToast,
  updateLayoutPanel,
  type OverlayElements,
} from './client/overlay'
import type { VisdiffSelectionGroup } from './types'

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
let selectionGroupId: string | null = null
let selectionGroupSequence = 0
let hovered: Element | null = null
let hoverSrc: SourceInfo | null = null
let source: SourceInfo | null = null
let baseline: ElementBaseline | null = null
let edits: EditMap | null = null
let applying = false
let selectSeq = 0

let overlay: OverlayElements | null = null
const changeBatch = new ChangeBatch({
  changed: renderPendingChanges,
  notify: (message) => toast(message, false),
})
const batchPanel = new BatchPanelController(
  () => overlay,
  {
    changes: () => changeBatch.changes,
    state: () => ({ running, applying }),
    apply: () => { void save() },
    clear: discardPendingChanges,
    removeChange: removeStagedChange,
  },
)

const elementEditor = new ElementEditor({
  activeTargets,
  selectedTarget: () => selected,
  sourceFor: (target) => sourceSync(target),
  selectionGroup: selectionGroupFor,
  isApplying: () => applying,
  stage: stageTargetChange,
  afterSelectedDrag(target) {
    if (selected !== target) return
    baseline = readBaseline(target)
    edits = {}
    source = sourceSync(target)
  },
  afterGroupDrag() {
    if (selectedGroup.length > 1) deselect()
  },
})

const layoutEditor = new LayoutEditor({
  selectedTargets: activeTargets,
  isApplying: () => applying,
  sourceFor: sourceSync,
  selectionGroup: selectionGroupFor,
  describeTarget: (target) => describe(target, sourceSync(target)),
  stage: stageTargetChange,
  updatePanel(count, target, label) {
    if (overlay !== null) updateLayoutPanel(overlay, count, target, label)
  },
  notify: (message) => toast(message, false),
})

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
  if (layoutEditor.hasChanges()) layoutEditor.resetPreview()
  selected = null
  selectedGroup = []
  selectionGroupId = null
  elementEditor.clearKeyboardMoves()
  baseline = null
  edits = null
  source = null
  layoutEditor.refresh()
  for (const node of [
    overlay?.layoutContainerFrame,
    ...(overlay?.selectionFrames ?? []),
    overlay?.handleE,
    overlay?.handleS,
    overlay?.handleSE,
    overlay?.bar,
  ]) {
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
  return layoutEditor.hasChanges()
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
function select(target: Element, additive = false): void {
  if (applying || isSystemUiElement(target)) return
  if (!(target instanceof HTMLElement) && !(target instanceof SVGElement)) return
  const active = target
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
  selectionGroupId = selectedGroup.length > 1 ? `selection-${++selectionGroupSequence}` : null
  baseline = readBaseline(selected)
  edits = {}
  const sync = sourceSync(selected)
  updateSelectionLabel(selected, sync, sync === null)
  if (sync !== null) source = sync
  if (overlay !== null) {
    overlay.bar.style.display = 'flex'
    positionBar(overlay, selected.getBoundingClientRect())
  }
  refreshLayoutPanel()
  positionSelection()
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

function refreshLayoutPanel(): void {
  layoutEditor.refresh()
}

function selectionGroupFor(target: HTMLElement | SVGElement): VisdiffSelectionGroup | undefined {
  if (selectionGroupId === null || selectedGroup.length < 2) return undefined
  return {
    id: selectionGroupId,
    selectedCount: selectedGroup.length,
    role: target === layoutEditor.target ? 'layout-container' : 'member',
  }
}

function applyLayout(property: LayoutProp, value: string): void {
  layoutEditor.apply(property, value)
}

function resetLayoutPreview(): void {
  layoutEditor.resetPreview()
}

function stageLayoutChange(): boolean {
  return layoutEditor.stage()
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
function startDrag(event: PointerEvent, mode: DragMode): void {
  elementEditor.startDrag(event, mode)
}

function moveSelectionByKeyboard(dx: number, dy: number): void {
  elementEditor.moveByKeyboard(dx, dy)
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

function stageTargetChange(
  target: HTMLElement | SVGElement,
  targetBaseline: ElementBaseline,
  targetSource: SourceInfo | null,
  targetEdits: EditMap,
  selectionGroup?: VisdiffSelectionGroup,
): boolean {
  return changeBatch.stage(target, targetBaseline, targetSource, targetEdits, selectionGroup)
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
  changeBatch.remove(groupIndex, property)
}

function discardPendingChanges(): void {
  if (applying) return
  if (hasEdits() || hasLayoutEdits()) resetOverrides(false)
  changeBatch.discard()
  deselect()
  toast('Pending changes discarded', false)
}

function renderPendingChanges(): void {
  batchPanel.render()
}

function hideBatchPanel(): void {
  batchPanel.hide()
}

function showBatchPanel(): void {
  batchPanel.show()
}

async function save(): Promise<void> {
  if (applying) return
  if (hasEdits() || hasLayoutEdits()) stageCurrentChange()
  if (changeBatch.isEmpty) {
    toast('No pending visual changes', false)
    return
  }
  const changes = changeBatch.taskChanges()
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
    changeBatch.clear()
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
  if (!running) return
  const target = ev.target
  if (!(target instanceof Element) || isSystemUiElement(target) || !document.contains(target)) {
    hoverBlur()
    return
  }
  if (activeTargets().some((item) => item === target || item.contains(target))) {
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
  if (!running) return
  if (ev.key === 'Escape') {
    if (selected !== null) cancelSelection()
    else exit()
    return
  }
  const eventTarget = ev.target
  if (eventTarget instanceof Element && eventTarget.closest('input, textarea, select, [contenteditable="true"], [data-vd-ui]') !== null) return
  if (ev.altKey || ev.ctrlKey || ev.metaKey) return
  if (selected === null) return
  const step = ev.shiftKey ? 10 : 1
  const delta = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }[ev.key]
  if (delta === undefined) return
  ev.preventDefault()
  moveSelectionByKeyboard(delta[0] ?? 0, delta[1] ?? 0)
}

function positionSelection(): void {
  const ui = overlay
  if (selected === null || ui === null) return
  updateSelectionPosition(ui, selected, activeTargets(), layoutEditor.target, stageCurrentChange)
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
    startPanelDrag: (event) => batchPanel.startDrag(event),
    hideBatchPanel,
    showBatchPanel,
    apply: () => { void save() },
    clear: discardPendingChanges,
    applyLayout,
  })

  document.addEventListener('mousemove', onHover, true)
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKey, true)
  window.addEventListener('resize', () => batchPanel.clamp())
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
