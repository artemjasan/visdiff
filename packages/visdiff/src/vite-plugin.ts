import type { Plugin, ViteDevServer, Connect } from 'vite'
import { createVisdiffHandler, VISDIFF_BASE } from './server-core'
import { injectReactSource } from './source-inject'
import type { VisdiffOptions } from './types'

/**
 * First-class Vite adapter: same-origin overlay
 * (script injection + /__visdiff endpoints live inside the dev server, no extra port).
 */
export function visdiffVite(options: VisdiffOptions = {}): Plugin {
  let projectRoot = options.root ?? process.cwd()
  return {
    name: 'visdiff',
    enforce: 'pre',
    apply: 'serve',
    configResolved(config) {
      projectRoot = options.root ?? config.root
    },
    transform(code, id) {
      return injectReactSource(code, id, projectRoot)
    },
    configureServer(server: ViteDevServer) {
      const root = options.root ?? server.config.root
      projectRoot = root
      const handler = createVisdiffHandler({ root })
      const middleware: Connect.NextHandleFunction = (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith(VISDIFF_BASE)) {
          next()
          return
        }
        handler(req, res)
          .then((handled) => {
            if (!handled) next()
          })
          .catch((err) => {
            console.error('[visdiff] middleware failed', err)
            next(err)
          })
      }
      server.middlewares.use(middleware)
    },
    transformIndexHtml() {
      return [
        { tag: 'script', attrs: { defer: true, src: `${VISDIFF_BASE}/client.js` }, injectTo: 'body' },
      ]
    },
  }
}

export default visdiffVite
