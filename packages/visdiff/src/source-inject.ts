import { existsSync } from 'node:fs'
import path from 'node:path'
import { transformSync, types as t, type PluginObj } from '@babel/core'
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
  if (!code.includes('<')) return null
  const idPath = id.split('?')[0] ?? id
  if (idPath.includes('/node_modules/')) return null
  const extension = path.extname(idPath)
  if (extension !== '.js' && extension !== '.jsx' && extension !== '.tsx') return null

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
  const file = relativeFile.split(path.sep).join('/')
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
