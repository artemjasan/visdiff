/**
 * Browser overlay: pick an element, adjust it visually, and stage each completed gesture.
 * The transparent change panel lists queued edits and submits the entire batch on Apply.
 */
import { resolveSource, type ElementSourceInfo } from 'element-source'
import type { VisdiffEdit, VisdiffTaskChange, VisdiffTaskElement } from './types'

interface SourceInfo {
  file: string
  line?: number
  column?: number
  component?: string
}
interface ElementBaseline {
  cssWidth: string
  cssHeight: string
  widthExtras: number
  heightExtras: number
  borderBox: boolean
  transform: string
  inlineTransform: string
  transformPriority: string
  inlineWidth: string
  widthPriority: string
  inlineHeight: string
  heightPriority: string
}


type EditRecord = VisdiffEdit
type EditList = VisdiffEdit[]
type EditProp = 'transform' | 'width' | 'height'
type DragMode = 'move' | 'w' | 'h' | 'wh'

type RestoreSnapshot = Pick<ElementBaseline,
  'inlineTransform' | 'transformPriority' | 'inlineWidth' | 'widthPriority' | 'inlineHeight' | 'heightPriority'
>

interface StagedChange {
  element: VisdiffTaskElement
  edits: EditList
  target: HTMLElement | SVGElement
  restore: RestoreSnapshot
}


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

const CSS_STYLES = `
#vd-toggle { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; padding: 9px 14px; border-radius: 999px; border: 1px solid #334155; background: rgba(15,23,42,.58); color: #e2e8f0; font: 600 12px/1 ui-sans-serif, system-ui, sans-serif; letter-spacing: .3px; cursor: pointer; box-shadow: 0 6px 16px rgba(15,23,42,.35); backdrop-filter: blur(10px); }
#vd-toggle:hover { background: rgba(30,41,59,.68); }
body.vd-on #vd-toggle { background: rgba(14,165,233,.66); border-color: #0284c7; color: #04283f; }
[data-vd-frame] { position: fixed; z-index: 2147482998; box-sizing: border-box; pointer-events: none; border: 1.5px solid #38bdf8; background: rgba(56,189,248,.08); }
[data-vd-selected] { border-color: #0ea5e9; background: rgba(14,165,233,.10); }
[data-vd-badge] { position: fixed; z-index: 2147482999; pointer-events: none; display: none; box-sizing: border-box; max-width: 70vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 3px 8px; border-radius: 6px; border: 1px solid #334155; background: rgba(15,23,42,.55); color: #7dd3fc; font: 600 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; backdrop-filter: blur(10px); }
[data-vd-handle] { position: fixed; z-index: 2147482999; box-sizing: border-box; width: 12px; height: 12px; border-radius: 3px; border: 2px solid #0ea5e9; background: #fff; cursor: nwse-resize !important; }
[data-vd-handle][data-mode="w"] { cursor: ew-resize !important; }
[data-vd-handle][data-mode="h"] { cursor: ns-resize !important; }
[data-vd-bar] { position: fixed; z-index: 2147482999; display: none; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 8px; border: 1px solid #334155; background: rgba(15,23,42,.55); box-shadow: 0 8px 20px rgba(2,6,23,.4); backdrop-filter: blur(10px); }
[data-vd-bar] [data-vd-label] { max-width: 38vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #7dd3fc; font: 600 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; }
[data-vd-bar] button { padding: 6px 10px; border: 0; border-radius: 6px; background: rgba(30,41,59,.58); color: #e2e8f0; font: 600 11px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
[data-vd-bar] button:hover { filter: brightness(1.15); }
[data-vd-batch] { position: fixed; left: 16px; bottom: 16px; z-index: 2147482999; display: none; flex-direction: column; gap: 8px; width: min(430px, calc(100vw - 32px)); max-height: min(42vh, 360px); box-sizing: border-box; padding: 12px; border: 1px solid rgba(148,163,184,.32); border-radius: 12px; background: rgba(15,23,42,.58); color: #e2e8f0; box-shadow: 0 12px 32px rgba(2,6,23,.38); backdrop-filter: blur(12px); font: 12px/1.4 ui-sans-serif, system-ui, sans-serif; }
[data-vd-batch-header] { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #bae6fd; font: 700 12px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; cursor: grab; user-select: none; }
[data-vd-batch-hide] { padding: 4px 7px !important; background: rgba(51,65,85,.52) !important; }
[data-vd-batch-restore] { position: fixed; left: 16px; bottom: 16px; z-index: 2147482999; display: none; padding: 9px 12px; border: 1px solid rgba(148,163,184,.32); border-radius: 9px; background: rgba(15,23,42,.58); color: #bae6fd; box-shadow: 0 8px 20px rgba(2,6,23,.35); backdrop-filter: blur(10px); font: 600 11px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
[data-vd-change-list] { display: flex; flex-direction: column; gap: 5px; overflow: auto; min-height: 0; }
[data-vd-note] { width: 100%; min-height: 54px; max-height: 120px; box-sizing: border-box; padding: 8px 9px; resize: vertical; border: 1px solid rgba(148,163,184,.22); border-radius: 7px; outline: none; background: rgba(15,23,42,.34); color: #e2e8f0; font: 12px/1.4 ui-sans-serif, system-ui, sans-serif; }
[data-vd-note]::placeholder { color: #94a3b8; }
[data-vd-comment-panel] { position: fixed; z-index: 2147483001; display: none; width: min(260px, calc(100vw - 32px)); box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid rgba(148,163,184,.32); border-radius: 10px; background: rgba(15,23,42,.6); color: #e2e8f0; box-shadow: 0 16px 32px rgba(2,6,23,.45); backdrop-filter: blur(12px); }
[data-vd-comment-panel] textarea { width: 100%; min-height: 72px; resize: vertical; box-sizing: border-box; padding: 8px 9px; border: 1px solid rgba(148,163,184,.22); border-radius: 7px; background: rgba(15,23,42,.34); color: #e2e8f0; font: 12px/1.4 ui-sans-serif, system-ui, sans-serif; }
[data-vd-comment-panel] textarea::placeholder { color: #94a3b8; }
[data-vd-comment-panel] div { display: flex; justify-content: flex-end; gap: 6px; }
[data-vd-comment-panel] button { padding: 6px 10px; border: 0; border-radius: 6px; background: rgba(51,65,85,.55); color: #e2e8f0; font: 600 11px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
[data-vd-comment-panel] button:last-child { background: rgba(14,165,233,.68); color: #04283f; }
[data-vd-change] { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 8px; padding: 7px 8px; border: 1px solid rgba(148,163,184,.15); border-radius: 7px; background: rgba(30,41,59,.38); }
[data-vd-change-label] { overflow: hidden; color: #cbd5e1; text-overflow: ellipsis; white-space: nowrap; font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
[data-vd-batch-actions] { display: flex; justify-content: flex-end; gap: 6px; }
[data-vd-batch] button { padding: 6px 10px; border: 0; border-radius: 6px; background: rgba(51,65,85,.52); color: #e2e8f0; font: 600 11px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
[data-vd-batch] button[data-vd-apply] { background: rgba(14,165,233,.68); color: #04283f; }
body.vd-on [data-vd-ui] button { cursor: pointer !important; }
[data-vd-toast] { position: fixed; z-index: 2147483000; left: 50%; transform: translateX(-50%); bottom: 60px; display: none; padding: 8px 14px; border-radius: 8px; border: 1px solid #334155; background: rgba(15,23,42,.55); color: #e2e8f0; font: 600 12px/1.4 ui-sans-serif, system-ui, sans-serif; box-shadow: 0 8px 24px rgba(2,6,23,.45); backdrop-filter: blur(10px); }
[data-vd-toast][data-err] { border-color: #f43f5e; color: #fecdd3; }
body.vd-on { user-select: none; }
body.vd-on * { cursor: crosshair !important; }
`

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
let toastTimer: NodeJS.Timeout | number | undefined = undefined

let btn: HTMLButtonElement | null = null
let frame: HTMLDivElement | null = null
let badge: HTMLDivElement | null = null
let selFrame: HTMLDivElement | null = null
let bar: HTMLDivElement | null = null
let barLabel: HTMLSpanElement | null = null
let batchPanel: HTMLDivElement | null = null
let batchTitle: HTMLSpanElement | null = null
let batchHeader: HTMLDivElement | null = null
let hideBatchBtn: HTMLButtonElement | null = null
let batchRestoreBtn: HTMLButtonElement | null = null
let batchList: HTMLDivElement | null = null
let batchNoteField: HTMLTextAreaElement | null = null
let commentEditor: HTMLDivElement | null = null
let commentField: HTMLTextAreaElement | null = null
let commentSaveBtn: HTMLButtonElement | null = null
let commentCancelBtn: HTMLButtonElement | null = null
let applyBatchBtn: HTMLButtonElement | null = null
let handleE: HTMLDivElement | null = null
let handleS: HTMLDivElement | null = null
let handleSE: HTMLDivElement | null = null
let toastEl: HTMLDivElement | null = null

/* --------------------------------------------------------------------- modes */
function enter(): void {
  if (running || btn === null) return
  running = true
  document.body.classList.add('vd-on')
  renderPendingChanges()
  requestAnimationFrame(tick)
}

function exit(): void {
  if (!running) return
  if (hasEdits()) stageCurrentChange()
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
  selected = null
  selectedGroup = []
  baseline = null
  edits = null
  source = null
  for (const node of [selFrame, handleE, handleS, handleSE, bar]) {
    if (node !== null) node.style.display = 'none'
  }
}

function activeTargets(): Array<HTMLElement | SVGElement> {
  if (selected === null) return selectedGroup
  if (selectedGroup.length === 0) return [selected]
  return selectedGroup.includes(selected) ? selectedGroup : [selected]
}

function hasEdits(): boolean {
  if (edits === null) return false
  return edits.transform !== undefined || edits.width !== undefined || edits.height !== undefined
}

function cancelSelection(): void {
  if (hasEdits()) resetOverrides(false)
  deselect()
}

function hoverBlur(): void {
  hovered = null
  hoverSrc = null
  if (frame !== null) frame.style.display = 'none'
  if (badge !== null) badge.style.display = 'none'
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
  return {
    cssWidth: computed.width,
    cssHeight: computed.height,
    widthExtras,
    heightExtras,
    borderBox: computed.boxSizing === 'border-box',
    transform: computed.transform,
    inlineTransform: el.style.getPropertyValue('transform'),
    transformPriority: el.style.getPropertyPriority('transform'),
    inlineWidth: el.style.getPropertyValue('width'),
    widthPriority: el.style.getPropertyPriority('width'),
    inlineHeight: el.style.getPropertyValue('height'),
    heightPriority: el.style.getPropertyPriority('height'),
  }
}

export function composeMoveTransform(baseTransform: string, dx: number, dy: number): string {
  const normalized = baseTransform && baseTransform !== 'none' ? baseTransform.trim() : ''
  if (normalized.length === 0) return `translate(${dx}px, ${dy}px)`
  return `translate(${dx}px, ${dy}px) ${normalized}`
}

function select(target: Element, additive = false): void {
  if (applying) return
  if (!(target instanceof HTMLElement) && !(target instanceof SVGElement)) return
  const active = target as HTMLElement | SVGElement
  const groupBefore = additive ? [...selectedGroup] : []
  if (selected !== null && hasEdits()) {
    if (selected === active && !additive) return
    if (!additive || groupBefore.length === 0 || (groupBefore.length === 1 && selected === active)) {
      stageCurrentChange()
    }
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
      selected = null
      return
    }
    selected = selectedGroup[selectedGroup.length - 1]
  } else {
    selectedGroup = [active]
    selected = active
  }
  baseline = readBaseline(selected)
  edits = {}
  const sync = sourceSync(selected)
  if (barLabel !== null) {
    barLabel.textContent = sync === null ? 'Resolving source…' : describe(selected, sync)
  }
  if (sync !== null) source = sync
  if (bar !== null) {
    bar.style.display = 'flex'
    positionBar(selected.getBoundingClientRect())
  }
  void resolveAsync(selected, seq)
}

async function resolveAsync(el: Element, seq: number): Promise<void> {
  try {
    const info: ElementSourceInfo | null = await resolveSource(el)
    if (seq !== selectSeq || selected !== el) return
    if (info !== null && typeof info.filePath === 'string') {
      source = {
        file: info.filePath,
        line: typeof info.lineNumber === 'number' ? info.lineNumber : undefined,
        column: typeof info.columnNumber === 'number' ? info.columnNumber : undefined,
        component: typeof info.componentName === 'string' ? info.componentName : undefined,
      }
      if (barLabel !== null) barLabel.textContent = describe(el, source)
    } else if (source === null && barLabel !== null) {
      barLabel.textContent = `${describe(el, null)} (no source)`
    }
  } catch {
    if (seq === selectSeq && selected === el && source === null && barLabel !== null) {
      barLabel.textContent = `${describe(el, null)} (no source)`
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

function resetOverrides(notify = true): void {
  if (selected === null || edits === null || baseline === null) return
  const el = selected
  if (edits.transform !== undefined) {
    restoreInlineStyle(el, 'transform', baseline.inlineTransform, baseline.transformPriority)
  }
  if (edits.width !== undefined) restoreInlineStyle(el, 'width', baseline.inlineWidth, baseline.widthPriority)
  if (edits.height !== undefined) restoreInlineStyle(el, 'height', baseline.inlineHeight, baseline.heightPriority)
  edits = {}
  baseline = readBaseline(el)
  if (notify) toast('Overrides cleared', false)
}

function currentEditList(targetEdits: Partial<Record<EditProp, EditRecord>> | null = edits): EditList {
  const list: EditList = []
  if (targetEdits === null) return list
  for (const prop of ['transform', 'width', 'height'] as const) {
    const edit = targetEdits[prop]
    if (edit === undefined) continue
    list.push({ property: edit.property, from: edit.from, to: edit.to, kind: edit.kind })
  }
  return list
}

function sameElement(left: VisdiffTaskElement, right: VisdiffTaskElement): boolean {
  if (left.selector !== right.selector) return false
  if (left.source === null || right.source === null) return left.source === right.source
  return left.source.file === right.source.file
    && left.source.line === right.source.line
    && left.source.column === right.source.column
}

function restoreStagedProperty(change: StagedChange, property: string): void {
  if (property === 'transform') {
    restoreInlineStyle(change.target, 'transform', change.restore.inlineTransform, change.restore.transformPriority)
  }
  if (property === 'width') {
    restoreInlineStyle(change.target, 'width', change.restore.inlineWidth, change.restore.widthPriority)
  }
  if (property === 'height') {
    restoreInlineStyle(change.target, 'height', change.restore.inlineHeight, change.restore.heightPriority)
  }
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
    if (effective.length === 0) return false
    staged = {
      element,
      edits: effective,
      target,
      restore: {
        inlineTransform: targetBaseline.inlineTransform,
        transformPriority: targetBaseline.transformPriority,
        inlineWidth: targetBaseline.inlineWidth,
        widthPriority: targetBaseline.widthPriority,
        inlineHeight: targetBaseline.inlineHeight,
        heightPriority: targetBaseline.heightPriority,
      },
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
  if (applying || selected === null || baseline === null || edits === null) return false
  const staged = stageTargetChange(selected, baseline, source, edits)
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
  if (hasEdits()) resetOverrides(false)
  for (const group of pendingChanges) {
    for (const edit of group.edits) restoreStagedProperty(group, edit.property)
  }
  pendingChanges = []
  deselect()
  renderPendingChanges()
  toast('Pending changes discarded', false)
}

function openCommentEditor(groupIndex: number, edit: VisdiffEdit): void {
  if (commentEditor === null || commentField === null || commentSaveBtn === null || commentCancelBtn === null) return
  commentField.value = edit.note ?? ''
  commentSaveBtn.onclick = () => {
    const trimmed = commentField.value.trim()
    if (trimmed.length > 0) edit.note = trimmed
    else delete edit.note
    hideCommentEditor()
    renderPendingChanges()
  }
  commentCancelBtn.onclick = () => {
    hideCommentEditor()
  }
  const row = batchList?.querySelectorAll('[data-vd-change]')[groupIndex]
  const rect = row instanceof Element ? row.getBoundingClientRect() : undefined
  commentEditor.style.left = `${rect ? rect.left : 24}px`
  commentEditor.style.top = `${rect ? rect.top + rect.height + 8 : 80}px`
  commentEditor.style.display = 'block'
  commentField.focus()
}

function hideCommentEditor(): void {
  if (commentEditor !== null) commentEditor.style.display = 'none'
}

function renderPendingChanges(): void {
  if (batchPanel === null || batchTitle === null || batchList === null) return
  batchList.replaceChildren()
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
      const actions = document.createElement('div')
      actions.style.display = 'flex'
      actions.style.alignItems = 'center'
      actions.style.gap = '6px'
      if (edit.note) {
        const noteBadge = document.createElement('span')
        noteBadge.textContent = '💬'
        noteBadge.title = edit.note
        actions.append(noteBadge)
      }
      const comment = document.createElement('button')
      comment.setAttribute('data-vd-ui', '')
      comment.textContent = edit.note ? '✎' : '💬'
      comment.title = edit.note ? 'Edit comment' : 'Add comment'
      comment.addEventListener('click', (event) => {
        event.stopPropagation()
        openCommentEditor(groupIndex, edit)
      })
      const remove = document.createElement('button')
      remove.setAttribute('data-vd-ui', '')
      remove.setAttribute('aria-label', `Remove ${edit.property} change for ${location}`)
      remove.textContent = '×'
      remove.addEventListener('click', () => removeStagedChange(groupIndex, edit.property))
      actions.append(comment, remove)
      row.append(label, actions)
      batchList.append(row)
    }
  }
  batchTitle.textContent = `${count} pending change${count === 1 ? '' : 's'}`
  if (count === 0) batchPanelHidden = false
  batchPanel.style.display = count === 0 || batchPanelHidden ? 'none' : 'flex'
  if (batchRestoreBtn !== null) {
    batchRestoreBtn.textContent = `Show changes (${count})`
    batchRestoreBtn.style.display = count > 0 && batchPanelHidden ? 'block' : 'none'
  }
  if (applyBatchBtn !== null) applyBatchBtn.disabled = count === 0 || applying
  if (btn !== null) {
    const countLabel = count === 0 ? '' : ` · ${count}`
    btn.textContent = `visdiff${countLabel}${running ? ' ✕' : ''}`
  }
}

function hideBatchPanel(): void {
  if (batchPanel === null || batchRestoreBtn === null || pendingChanges.length === 0) return
  const rect = batchPanel.getBoundingClientRect()
  const maxLeft = Math.max(0, window.innerWidth - 150)
  const maxTop = Math.max(0, window.innerHeight - 38)
  batchRestoreBtn.style.left = `${Math.min(Math.max(rect.left, 0), maxLeft)}px`
  batchRestoreBtn.style.top = `${Math.min(Math.max(rect.top, 0), maxTop)}px`
  batchRestoreBtn.style.right = 'auto'
  batchRestoreBtn.style.bottom = 'auto'
  batchPanelHidden = true
  renderPendingChanges()
}

function showBatchPanel(): void {
  if (batchPanel === null || batchRestoreBtn === null) return
  const rect = batchRestoreBtn.getBoundingClientRect()
  batchPanel.style.left = `${rect.left}px`
  batchPanel.style.top = `${rect.top}px`
  batchPanel.style.right = 'auto'
  batchPanel.style.bottom = 'auto'
  batchPanelHidden = false
  renderPendingChanges()
  clampBatchPanel()
}

function clampBatchPanel(): void {
  const panel = batchPanelHidden ? batchRestoreBtn : batchPanel
  if (panel === null || panel.style.display === 'none') return
  const rect = panel.getBoundingClientRect()
  const maxLeft = Math.max(0, window.innerWidth - rect.width)
  const maxTop = Math.max(0, window.innerHeight - rect.height)
  panel.style.left = `${Math.min(Math.max(rect.left, 0), maxLeft)}px`
  panel.style.top = `${Math.min(Math.max(rect.top, 0), maxTop)}px`
  panel.style.right = 'auto'
  panel.style.bottom = 'auto'
}

function startBatchPanelDrag(ev: PointerEvent): void {
  if (applying || batchPanel === null || batchPanelHidden) return
  const target = ev.target
  if (target instanceof Element && target.closest('button') !== null) return
  ev.preventDefault()
  ev.stopPropagation()
  const rect = batchPanel.getBoundingClientRect()
  const startX = ev.clientX
  const startY = ev.clientY
  const pointerId = ev.pointerId
  batchPanel.style.left = `${rect.left}px`
  batchPanel.style.top = `${rect.top}px`
  batchPanel.style.right = 'auto'
  batchPanel.style.bottom = 'auto'
  const onMove = (move: PointerEvent): void => {
    if (move.pointerId !== pointerId || batchPanel === null) return
    const maxLeft = Math.max(0, window.innerWidth - rect.width)
    const maxTop = Math.max(0, window.innerHeight - rect.height)
    const left = Math.min(Math.max(rect.left + move.clientX - startX, 0), maxLeft)
    const top = Math.min(Math.max(rect.top + move.clientY - startY, 0), maxTop)
    batchPanel.style.left = `${left}px`
    batchPanel.style.top = `${top}px`
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
  if (hasEdits()) stageCurrentChange()
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
  const note = batchNoteField?.value.trim() ?? ''
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
  if (!(target instanceof Element) || target.hasAttribute('data-vd-ui') || !document.contains(target)) {
    hoverBlur()
    return
  }
  if (target === hovered) return
  hovered = target
  hoverSrc = sourceSync(target)
  const rect = target.getBoundingClientRect()
  if (frame !== null) setBox(frame, rect)
  if (badge !== null) {
    badge.textContent = describe(target, hoverSrc)
    badge.style.display = 'block'
    badge.style.left = `${Math.max(rect.left, 8)}px`
    badge.style.top = `${Math.max(rect.top - 24, 4)}px`
  }
}

function onPointerDown(ev: PointerEvent): void {
  if (!running || applying) return
  const target = ev.target
  if (!(target instanceof HTMLElement) && !(target instanceof SVGElement)) return
  if (target.closest('[data-vd-ui]') !== null) return
  ev.preventDefault()
  ev.stopPropagation()
  if (selected !== null && (target === selected || selected.contains(target))) {
    if (selectedGroup.length > 1 && ev.shiftKey) {
      startDrag(ev, 'move')
      return
    }
    if (selectedGroup.length > 1 && target !== selected) {
      selected = target
      baseline = readBaseline(target)
      edits = {}
      source = sourceSync(target)
      return
    }
    startDrag(ev, 'move')
    return
  }
  if (ev.shiftKey) {
    select(target, true)
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
  if (bar === null) return
  const left = Math.min(Math.max(rect.left, 8), Math.max(window.innerWidth - 260, 8))
  const nearTop = rect.top >= 46
  bar.style.left = `${left}px`
  bar.style.top = `${nearTop ? rect.top - 42 : rect.bottom + 6}px`
}

function positionSelection(): void {
  if (selected === null || selFrame === null || bar === null) return
  if (!document.contains(selected)) {
    // Preserve the visual edit in the batch even if HMR swaps its DOM node.
    stageCurrentChange()
    return
  }
  const rect = selected.getBoundingClientRect()
  setBox(selFrame, rect)
  if (handleE !== null) {
    handleE.style.display = 'block'
    handleE.style.left = `${rect.right - 6}px`
    handleE.style.top = `${rect.top + rect.height / 2 - 6}px`
  }
  if (handleS !== null) {
    handleS.style.display = 'block'
    handleS.style.left = `${rect.left + rect.width / 2 - 6}px`
    handleS.style.top = `${rect.bottom - 6}px`
  }
  if (handleSE !== null) {
    handleSE.style.display = 'block'
    handleSE.style.left = `${rect.right - 6}px`
    handleSE.style.top = `${rect.bottom - 6}px`
  }
  positionBar(rect)
}

function tick(): void {
  if (!running) return
  if (selected !== null) {
    positionSelection()
  } else if (hovered !== null && document.contains(hovered)) {
    const rect = hovered.getBoundingClientRect()
    if (frame !== null) setBox(frame, rect)
  }
  requestAnimationFrame(tick)
}

/* ----------------------------------------------------------- source mapping */
// dev frameworks attach source-locating properties to DOM nodes; Element type does not model them
function readAttrSource(target: Element, attrName: string): SourceInfo | null {
  const node = target.closest(`[${attrName}]`)
  if (node === null) return null
  const attr = node.getAttribute(attrName)
  if (attr === null) return null
  let raw: unknown
  try {
    raw = JSON.parse(attr)
  } catch {
    // malformed JSON attr → unsupported
    return null
  }
  if (typeof raw === 'object' && raw !== null && 'file' in raw && typeof raw.file === 'string') {
    return {
      file: raw.file,
      line: 'line' in raw && typeof raw.line === 'number' ? raw.line : undefined,
      column: 'column' in raw && typeof raw.column === 'number' ? raw.column : undefined,
      component: 'component' in raw && typeof raw.component === 'string' ? raw.component : undefined,
    }
  }
  return null
}

function sourceSync(target: Element): SourceInfo | null {
  const decorated = readAttrSource(target, 'data-visdiff-src')
  if (decorated !== null) return decorated
  const vueInspector = readAttrSource(target, 'data-v-inspector')
  if (vueInspector !== null) return vueInspector

  const host: Record<string, unknown> = target as unknown as Record<string, unknown>
  const svelteRaw: unknown = host.__svelte_meta
  if (typeof svelteRaw === 'object' && svelteRaw !== null && 'loc' in svelteRaw) {
    const locRaw: unknown = svelteRaw.loc
    if (
      typeof locRaw === 'object' &&
      locRaw !== null &&
      'file' in locRaw &&
      typeof locRaw.file === 'string'
    ) {
      return {
        file: locRaw.file,
        line: 'line' in locRaw && typeof locRaw.line === 'number' ? locRaw.line : undefined,
        column: 'col' in locRaw && typeof locRaw.col === 'number' ? locRaw.col : undefined,
      }
    }
  }

  const fiberKey = Object.keys(host).find((key) => key.startsWith('__reactFiber$'))
  if (fiberKey === undefined) return null
  const fiberRaw: unknown = host[fiberKey]
  if (typeof fiberRaw !== 'object' || fiberRaw === null || !('_debugSource' in fiberRaw)) return null
  const debugRaw: unknown = fiberRaw._debugSource
  if (typeof debugRaw !== 'object' || debugRaw === null) return null
  if (!('fileName' in debugRaw) || typeof debugRaw.fileName !== 'string') return null
  let component: string | undefined
  if ('type' in fiberRaw) {
    const typeRaw: unknown = fiberRaw.type
    if (typeof typeRaw === 'object' && typeRaw !== null) {
      if ('displayName' in typeRaw && typeof typeRaw.displayName === 'string') {
        component = typeRaw.displayName
      } else if ('name' in typeRaw && typeof typeRaw.name === 'string') {
        component = typeRaw.name
      }
    } else if (typeof typeRaw === 'function') {
      component = typeRaw.name
    }
  }
  return {
    file: debugRaw.fileName,
    line: 'lineNumber' in debugRaw && typeof debugRaw.lineNumber === 'number' ? debugRaw.lineNumber : undefined,
    column: 'columnNumber' in debugRaw && typeof debugRaw.columnNumber === 'number' ? debugRaw.columnNumber : undefined,
    component,
  }
}

function describe(el: Element, src: SourceInfo | null): string {
  if (src !== null) {
    const line = src.line !== undefined ? `:${src.line}` : ''
    const column = src.column !== undefined && src.line !== undefined ? `:${src.column}` : ''
    const component = src.component !== undefined ? ` — ${src.component}` : ''
    return `${src.file}${line}${column}${component}`
  }
  return cssPath(el)
}

/** CSS.escape is missing from this lib; escape an id for use inside a selector. */
function cssEscape(id: string): string {
  const str = String(id)
  if (CSS !== undefined && typeof CSS.escape === 'function') return CSS.escape(str)
  let out = ''
  for (const ch of str) {
    if (/["'\\>\[\]#,\s]/.test(ch)) {
      out += `\\${ch}`
      continue
    }
    out += ch
  }
  return out
}

function cssPath(node: Element): string {
  const parts: string[] = []
  let current: Element | null = node
  let depth = 0
  while (current !== null && depth < 6 && current !== document.body) {
    const id = current.getAttribute('id')
    if (id !== null && id.length > 0) {
      parts.push(`${current.tagName.toLowerCase()}#${cssEscape(id)}`)
      break
    }
    let nth = 1
    let prev = current.previousElementSibling
    while (prev !== null) {
      if (prev.tagName === current.tagName) nth += 1
      prev = prev.previousElementSibling
    }
    parts.push(`${current.tagName.toLowerCase()}:nth-of-type(${nth})`)
    current = current.parentElement
    depth += 1
  }
  return parts.reverse().join(' > ')
}

/* ---------------------------------------------------------------- feed-face */
function toast(message: string, isError: boolean): void {
  if (toastEl === null) return
  clearTimeout(toastTimer)
  toastEl.textContent = message
  if (isError) toastEl.setAttribute('data-err', '')
  else toastEl.removeAttribute('data-err')
  toastEl.style.display = 'block'
  toastTimer = setTimeout(() => {
    if (toastEl !== null) toastEl.style.display = 'none'
  }, 2600)
}

/* ---------------------------------------------------------------- mount ---- */
function makeHandle(mode: DragMode): HTMLDivElement {
  const handle = document.createElement('div')
  handle.setAttribute('data-vd-handle', '')
  handle.setAttribute('data-mode', mode)
  handle.setAttribute('data-vd-ui', '')
  handle.addEventListener('pointerdown', (ev) => startDrag(ev, mode))
  return handle
}

function mountUI(): void {
  const style = document.createElement('style')
  style.textContent = CSS_STYLES
  document.head.appendChild(style)

  btn = document.createElement('button')
  btn.id = 'vd-toggle'
  btn.setAttribute('data-vd-ui', '')
  btn.textContent = 'visdiff'
  btn.addEventListener('click', () => toggle())

  frame = document.createElement('div')
  frame.setAttribute('data-vd-frame', '')

  badge = document.createElement('div')
  badge.setAttribute('data-vd-badge', '')

  selFrame = document.createElement('div')
  selFrame.setAttribute('data-vd-frame', '')
  selFrame.setAttribute('data-vd-selected', '')

  handleE = makeHandle('w')
  handleS = makeHandle('h')
  handleSE = makeHandle('wh')

  bar = document.createElement('div')
  bar.setAttribute('data-vd-bar', '')
  bar.setAttribute('data-vd-ui', '')
  barLabel = document.createElement('span')
  barLabel.setAttribute('data-vd-label', '')
  const resetBtn = document.createElement('button')
  resetBtn.textContent = '↺ Reset'
  resetBtn.addEventListener('click', () => resetOverrides())
  const cancelBtn = document.createElement('button')
  cancelBtn.textContent = '✕'
  cancelBtn.addEventListener('click', () => cancelSelection())
  bar.append(barLabel, resetBtn, cancelBtn)

  batchPanel = document.createElement('div')
  batchPanel.setAttribute('data-vd-batch', '')
  batchPanel.setAttribute('data-vd-ui', '')
  batchHeader = document.createElement('div')
  batchHeader.setAttribute('data-vd-batch-header', '')
  batchHeader.addEventListener('pointerdown', startBatchPanelDrag)
  batchTitle = document.createElement('span')
  batchTitle.setAttribute('data-vd-batch-title', '')
  hideBatchBtn = document.createElement('button')
  hideBatchBtn.setAttribute('data-vd-ui', '')
  hideBatchBtn.setAttribute('data-vd-batch-hide', '')
  hideBatchBtn.textContent = 'Hide'
  hideBatchBtn.addEventListener('click', hideBatchPanel)
  batchHeader.append(batchTitle, hideBatchBtn)
  batchList = document.createElement('div')
  batchList.setAttribute('data-vd-change-list', '')
  const actions = document.createElement('div')
  actions.setAttribute('data-vd-batch-actions', '')
  applyBatchBtn = document.createElement('button')
  applyBatchBtn.setAttribute('data-vd-apply', '')
  applyBatchBtn.textContent = 'Apply'
  applyBatchBtn.addEventListener('click', () => {
    void save()
  })
  const clearBatchBtn = document.createElement('button')
  clearBatchBtn.textContent = 'Clear'
  clearBatchBtn.addEventListener('click', discardPendingChanges)
  actions.append(applyBatchBtn, clearBatchBtn)
  batchNoteField = document.createElement('textarea')
  batchNoteField.setAttribute('data-vd-note', '')
  batchNoteField.placeholder = 'Optional note for the agent'
  batchNoteField.maxLength = 1000
  batchNoteField.rows = 2
  batchNoteField.style.display = 'none'
  commentEditor = document.createElement('div')
  commentEditor.setAttribute('data-vd-comment-panel', '')
  commentEditor.style.display = 'none'
  commentField = document.createElement('textarea')
  commentField.rows = 3
  commentField.maxLength = 400
  commentField.placeholder = 'Add a comment for this row'
  commentSaveBtn = document.createElement('button')
  commentSaveBtn.textContent = 'Save'
  commentCancelBtn = document.createElement('button')
  commentCancelBtn.textContent = 'Cancel'
  const commentActions = document.createElement('div')
  commentActions.style.display = 'flex'
  commentActions.style.justifyContent = 'flex-end'
  commentActions.style.gap = '6px'
  commentActions.append(commentCancelBtn, commentSaveBtn)
  commentEditor.append(commentField, commentActions)
  batchPanel.append(batchHeader, batchList, actions)
  batchRestoreBtn = document.createElement('button')
  batchRestoreBtn.setAttribute('data-vd-batch-restore', '')
  batchRestoreBtn.setAttribute('data-vd-ui', '')
  batchRestoreBtn.addEventListener('click', showBatchPanel)

  toastEl = document.createElement('div')
  toastEl.setAttribute('data-vd-toast', '')

  document.body.append(btn, frame, badge, selFrame, handleE, handleS, handleSE, bar, batchPanel, commentEditor, batchRestoreBtn, toastEl)

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
