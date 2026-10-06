import { resolveSource, type ElementSourceInfo } from 'element-source'
import type { SourceInfo } from './model'

export async function resolveElementSource(el: Element): Promise<ElementSourceInfo | null> {
  return resolveSource(el)
}

export function sourceSync(target: Element): SourceInfo | null {
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

export function describe(el: Element, src: SourceInfo | null): string {
  if (src !== null) {
    const line = src.line !== undefined ? `:${src.line}` : ''
    const column = src.column !== undefined && src.line !== undefined ? `:${src.column}` : ''
    const component = src.component !== undefined ? ` — ${src.component}` : ''
    return `${src.file}${line}${column}${component}`
  }
  return cssPath(el)
}

function readAttrSource(target: Element, attrName: string): SourceInfo | null {
  const node = target.closest(`[${attrName}]`)
  if (node === null) return null
  const raw = node.getAttribute(attrName)
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || !('file' in parsed) || typeof parsed.file !== 'string') {
      return null
    }
    return {
      file: parsed.file,
      line: 'line' in parsed && typeof parsed.line === 'number' ? parsed.line : undefined,
      column: 'column' in parsed && typeof parsed.column === 'number' ? parsed.column : undefined,
      component: 'component' in parsed && typeof parsed.component === 'string' ? parsed.component : undefined,
    }
  } catch {
    return null
  }
}

function cssEscape(id: string): string {
  const str = String(id)
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(str)
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

export function cssPath(node: Element): string {
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
