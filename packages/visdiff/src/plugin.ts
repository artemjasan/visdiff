import { createUnplugin, type UnpluginFactory } from 'unplugin'
import { startStandaloneServer, type StandaloneServer } from './server-core'
import { injectReactSource } from './source-inject'
import type { VisdiffOptions } from './types'

/**
 * Universal unplugin: works on Vite, Rollup, Webpack, Rspack, Rsbuild, Rolldown, esbuild, Farm, Bun.
 * Starts one shared endpoint server (default http://127.0.0.1:9090) and serves the overlay client.
 * Script injection is bundler-specific: on Vite prefer `visdiffVite` (see ./vite); elsewhere add
 * `<script defer src="http://127.0.0.1:<port>/__visdiff/client.js"></script>` to the dev page.
 * The generic adapter starts only when NODE_ENV=development unless `enabled: true` is passed.
 */
export type VisdiffFactory = UnpluginFactory<VisdiffOptions | undefined>

export const unpluginFactory: VisdiffFactory = (options = {}) => {
  const root = options.root ?? process.cwd()
  const port = options.port ?? 9090
  const key = `${root}:${port}`
  return {
    name: 'visdiff',
    buildStart(): void {
      if (options.enabled !== true && process.env.NODE_ENV !== 'development') return
      const existing = servers[key]
      if (existing === undefined) {
        const starting = startStandaloneServer({ root, port }).catch((err) => {
          delete servers[key]
          throw err
        })
        servers[key] = starting
        starting.catch((err: unknown) => console.error(`[visdiff] endpoint failed to start: ${String(err)}`))
      }
    },
    transform(code, id) {
      if (options.enabled !== true && process.env.NODE_ENV !== 'development') return null
      return injectReactSource(code, id, root)
    },
  }
}

const servers: Record<string, Promise<StandaloneServer>> = {}

export const unplugin = createUnplugin(unpluginFactory)
export default unplugin
