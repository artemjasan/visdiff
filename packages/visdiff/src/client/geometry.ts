import { ensureSelectionFrames, type OverlayElements } from './overlay'

type EditableElement = HTMLElement | SVGElement

export function setBox(element: HTMLElement, rect: DOMRect): void {
  element.style.display = 'block'
  element.style.left = `${rect.left}px`
  element.style.top = `${rect.top}px`
  element.style.width = `${rect.width}px`
  element.style.height = `${rect.height}px`
}

export function positionBar(ui: OverlayElements, rect: DOMRect): void {
  const left = Math.min(Math.max(rect.left, 8), Math.max(window.innerWidth - ui.bar.offsetWidth - 8, 8))
  ui.bar.style.left = `${left}px`
  const barHeight = ui.bar.offsetHeight
  const above = rect.top - barHeight - 8 >= 8
  const preferredTop = above ? rect.top - barHeight - 8 : rect.bottom + 8
  const maxTop = Math.max(8, window.innerHeight - barHeight - 8)
  ui.bar.style.top = `${Math.min(Math.max(preferredTop, 8), maxTop)}px`
}

export function positionSelection(
  ui: OverlayElements,
  selected: EditableElement,
  targets: EditableElement[],
  layoutContainer: HTMLElement | null,
  onRemoved: () => void,
): void {
  if (!document.contains(selected)) {
    onRemoved()
    return
  }

  const frames = ensureSelectionFrames(ui, targets.length)
  for (let index = 0; index < targets.length; index++) {
    const target = targets[index]
    const frame = frames[index]
    if (target === undefined || frame === undefined || !document.contains(target)) {
      if (frame !== undefined) frame.style.display = 'none'
      continue
    }
    if (target === selected) frame.setAttribute('data-vd-active', '')
    else frame.removeAttribute('data-vd-active')
    setBox(frame, target.getBoundingClientRect())
  }

  if (layoutContainer !== null && document.contains(layoutContainer)) {
    setBox(ui.layoutContainerFrame, layoutContainer.getBoundingClientRect())
  } else {
    ui.layoutContainerFrame.style.display = 'none'
  }

  const rect = selected.getBoundingClientRect()
  ui.handleE.style.display = 'block'
  ui.handleE.style.left = `${rect.right - 6}px`
  ui.handleE.style.top = `${rect.top + rect.height / 2 - 6}px`
  ui.handleS.style.display = 'block'
  ui.handleS.style.left = `${rect.left + rect.width / 2 - 6}px`
  ui.handleS.style.top = `${rect.bottom - 6}px`
  ui.handleSE.style.display = 'block'
  ui.handleSE.style.left = `${rect.right - 6}px`
  ui.handleSE.style.top = `${rect.bottom - 6}px`
  positionBar(ui, rect)
}
