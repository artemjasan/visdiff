import { existsSync } from 'node:fs'
import path from 'node:path'
import { transformSync, types as t, type PluginObj } from '@babel/core'
import MagicString from 'magic-string'
interface SourceInjectionMap {
  file?: string
  version: number
  mappings: string
  names: string[]
  sourceRoot?: string
  sources: string[]
  sourcesContent?: string[]
}

interface SourceInjectionResult {
  code: string
  map?: SourceInjectionMap
}

/**
 * Attach a compact project-relative source anchor to JSX host elements.
 * Runs before the framework JSX transform, so it works in React 19 without Fiber internals.
 */
export function injectReactSource(code: string, id: string, projectRoot: string): SourceInjectionResult | null {
  const sourceFile = resolveSourceFile(id, projectRoot)
  if (sourceFile === null || !code.includes('<')) return null
  const { idPath, file } = sourceFile
  const extension = path.extname(idPath)
  if (extension !== '.js' && extension !== '.jsx' && extension !== '.tsx') return null
  const root = path.resolve(projectRoot)

  let changed = false

  const sourcePlugin: PluginObj = {
    visitor: {
      JSXOpeningElement(nodePath) {
        const hasSource = nodePath.node.attributes.some((attribute) => (
          t.isJSXAttribute(attribute) &&
          t.isJSXIdentifier(attribute.name, { name: 'data-visdiff-src' })
        ))
        if (hasSource) return
        const start = nodePath.node.loc?.start
        if (start === undefined) return
        const source = JSON.stringify({ file, line: start.line, column: start.column + 1 })
        nodePath.node.attributes.push(
          t.jsxAttribute(
            t.jsxIdentifier('data-visdiff-src'),
            t.jsxExpressionContainer(t.stringLiteral(source)),
          ),
        )
        changed = true
      },
    },
  }

  try {
    const result = transformSync(code, {
      filename: idPath,
      root,
      configFile: false,
      babelrc: false,
      ast: false,
      sourceMaps: true,
      retainLines: true,
      parserOpts: {
        sourceType: 'unambiguous',
        plugins: extension === '.tsx' ? ['typescript', 'jsx'] : ['jsx'],
      },
      plugins: [sourcePlugin],
    })
    if (!changed || result === null || typeof result.code !== 'string') return null
    if (result.map === null || result.map === undefined) return { code: result.code }
    const map = result.map
    return {
      code: result.code,
      map: {
        file: map.file,
        version: map.version,
        mappings: map.mappings,
        names: map.names,
        sourceRoot: map.sourceRoot,
        sources: map.sources,
        sourcesContent: map.sourcesContent,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[visdiff] source injection skipped for ${file}: ${message}`)
    return null
  }
}

export function injectSource(
  code: string,
  id: string,
  projectRoot: string,
): SourceInjectionResult | null | Promise<SourceInjectionResult | null> {
  const idPath = id.split('?')[0] ?? id
  if (idPath.endsWith('.vue')) return injectVueSource(code, id, projectRoot)
  if (idPath.endsWith('.svelte')) return injectSvelteSource(code, id, projectRoot)
  return injectReactSource(code, id, projectRoot)
}

export async function injectVueSource(
  code: string,
  id: string,
  projectRoot: string,
): Promise<SourceInjectionResult | null> {
  const sourceFile = resolveSourceFile(id, projectRoot)
  if (sourceFile === null || path.extname(sourceFile.idPath) !== '.vue') return null
  const { idPath, file } = sourceFile
  const sfcCompiler = await import('@vue/compiler-sfc')
  const templateCompiler = await import('@vue/compiler-dom')
  const { descriptor } = sfcCompiler.parse(code, { filename: idPath })
  if (descriptor.template === null) return null

  const template = descriptor.template
  const ast = templateCompiler.parse(template.content)
  const insertions: SourceInsertion[] = []
  const locate = createSourceLocator(code)
  const { ELEMENT, ATTRIBUTE } = templateCompiler.NodeTypes
  const visit = (node: typeof ast.children[number]): void => {
    if (node.type === ELEMENT) {
      const hasSource = node.props.some((prop) => prop.type === ATTRIBUTE && prop.name === 'data-visdiff-src')
      if (!hasSource) {
        const offset = template.loc.start.offset + node.loc.start.offset
        const location = locate(offset)
        insertions.push({
          offset: offset + 1 + node.tag.length,
          value: sourceAttribute({ file, ...location }),
        })
      }
      node.children.forEach(visit)
    }
  }
  ast.children.forEach(visit)
  return applySourceInsertions(code, idPath, insertions)
}

export async function injectSvelteSource(
  code: string,
  id: string,
  projectRoot: string,
): Promise<SourceInjectionResult | null> {
  const sourceFile = resolveSourceFile(id, projectRoot)
  if (sourceFile === null || path.extname(sourceFile.idPath) !== '.svelte') return null
  const { idPath, file } = sourceFile
  const compiler = await import('svelte/compiler')
  const ast = compiler.parse(code, { filename: idPath, modern: false })
  const insertions: SourceInsertion[] = []
  const locate = createSourceLocator(code)

  interface SvelteNode {
    type: string
    start?: number
    name?: string
    attributes?: Array<{ type: string; name: string }>
    children?: SvelteNode[]
  }

  const visit = (node: SvelteNode): void => {
    if (node.type === 'Element' && typeof node.start === 'number' && typeof node.name === 'string') {
      const hasSource = node.attributes?.some((attribute) => (
        attribute.type === 'Attribute' && attribute.name === 'data-visdiff-src'
      )) ?? false
      if (!hasSource) {
        const location = locate(node.start)
        insertions.push({
          offset: node.start + 1 + node.name.length,
          value: svelteSourceAttribute({ file, ...location }),
        })
      }
    }
    node.children?.forEach(visit)
  }

  const template = ast.html as unknown as { children: SvelteNode[] }
  template.children.forEach(visit)
  return applySourceInsertions(code, idPath, insertions)
}

interface SourceInsertion {
  offset: number
  value: string
}

interface SourceLocation {
  line: number
  column: number
}

function resolveSourceFile(id: string, projectRoot: string): { idPath: string; file: string } | null {
  const idPath = id.split('?')[0] ?? id
  if (idPath.includes('/node_modules/')) return null
  const root = path.resolve(projectRoot)
  let absoluteFile: string
  if (path.isAbsolute(idPath)) {
    const candidate = path.resolve(idPath)
    const candidateRelative = path.relative(root, candidate)
    const outsideRoot = candidateRelative === '..' || candidateRelative.startsWith(`..${path.sep}`) || path.isAbsolute(candidateRelative)
    if (!outsideRoot) {
      absoluteFile = candidate
    } else {
      const rootRelative = path.resolve(root, idPath.replace(/^[/\\]+/, ''))
      if (!existsSync(rootRelative)) return null
      absoluteFile = rootRelative
    }
  } else {
    absoluteFile = path.resolve(root, idPath)
  }
  const relativeFile = path.relative(root, absoluteFile)
  if (relativeFile === '..' || relativeFile.startsWith(`..${path.sep}`) || path.isAbsolute(relativeFile)) return null
  return { idPath, file: relativeFile.split(path.sep).join('/') }
}

function createSourceLocator(source: string): (offset: number) => SourceLocation {
  const lineStarts = [0]
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '\n') lineStarts.push(index + 1)
  }
  return (offset) => {
    let low = 0
    let high = lineStarts.length
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if ((lineStarts[middle] ?? 0) <= offset) low = middle + 1
      else high = middle
    }
    const lineStart = lineStarts[low - 1] ?? 0
    return { line: low, column: offset - lineStart + 1 }
  }
}

function sourceAttribute(source: { file: string; line: number; column: number }): string {
  const json = JSON.stringify(source)
  const escaped = json.replaceAll('&', '&amp;').replaceAll("'", '&#39;').replaceAll('<', '&lt;')
  return ` data-visdiff-src='${escaped}'`
}

function svelteSourceAttribute(source: { file: string; line: number; column: number }): string {
  return ` data-visdiff-src={${JSON.stringify(JSON.stringify(source))}}`
}

function applySourceInsertions(
  code: string,
  idPath: string,
  insertions: SourceInsertion[],
): SourceInjectionResult | null {
  if (insertions.length === 0) return null
  const source = new MagicString(code)
  for (const insertion of insertions.sort((left, right) => right.offset - left.offset)) {
    source.appendLeft(insertion.offset, insertion.value)
  }
  const map = source.generateMap({ hires: true, source: idPath, includeContent: true })
  return {
    code: source.toString(),
    map: {
      file: map.file ?? undefined,
      version: map.version,
      mappings: map.mappings,
      names: map.names,
      sources: map.sources,
      sourcesContent: map.sourcesContent ?? undefined,
    },
  }
}
