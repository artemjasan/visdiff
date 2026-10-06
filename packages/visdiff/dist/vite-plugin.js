import {
  VISDIFF_BASE,
  createVisdiffHandler,
  injectReactSource
} from "./chunk-UOZZAGRJ.js";

// src/vite-plugin.ts
function visdiffVite(options = {}) {
  let projectRoot = options.root ?? process.cwd();
  return {
    name: "visdiff",
    enforce: "pre",
    apply: "serve",
    configResolved(config) {
      projectRoot = options.root ?? config.root;
    },
    transform(code, id) {
      return injectReactSource(code, id, projectRoot);
    },
    configureServer(server) {
      const root = options.root ?? server.config.root;
      projectRoot = root;
      const handler = createVisdiffHandler({ root });
      const middleware = (req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith(VISDIFF_BASE)) {
          next();
          return;
        }
        handler(req, res).then((handled) => {
          if (!handled) next();
        }).catch((err) => {
          console.error("[visdiff] middleware failed", err);
          next(err);
        });
      };
      server.middlewares.use(middleware);
    },
    transformIndexHtml() {
      return [
        { tag: "script", attrs: { defer: true, src: `${VISDIFF_BASE}/client.js` }, injectTo: "body" }
      ];
    }
  };
}
var vite_plugin_default = visdiffVite;
export {
  vite_plugin_default as default,
  visdiffVite
};
