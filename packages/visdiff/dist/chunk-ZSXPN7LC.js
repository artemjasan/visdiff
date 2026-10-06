import {
  injectReactSource,
  startStandaloneServer
} from "./chunk-Y7PD535Q.js";

// src/plugin.ts
import { createUnplugin } from "unplugin";
var unpluginFactory = (options = {}) => {
  const root = options.root ?? process.cwd();
  const port = options.port ?? 9090;
  const key = `${root}:${port}`;
  return {
    name: "visdiff",
    buildStart() {
      if (options.enabled !== true && process.env.NODE_ENV !== "development") return;
      const existing = servers[key];
      if (existing === void 0) {
        const starting = startStandaloneServer({ root, port }).catch((err) => {
          delete servers[key];
          throw err;
        });
        servers[key] = starting;
        starting.catch((err) => console.error(`[visdiff] endpoint failed to start: ${String(err)}`));
      }
    },
    transform(code, id) {
      if (options.enabled !== true && process.env.NODE_ENV !== "development") return null;
      return injectReactSource(code, id, root);
    }
  };
};
var servers = {};
var unplugin = createUnplugin(unpluginFactory);
var plugin_default = unplugin;

export {
  unpluginFactory,
  unplugin,
  plugin_default
};
