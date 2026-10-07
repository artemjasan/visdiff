# Framework and bundler support

Visdiff has one fully integrated path and a set of lower-level adapters. The table separates automatic source anchors from loading the browser overlay; these are different capabilities.

## Support matrix

| Framework | Vite integration | Generic adapters (Rollup, Webpack, Rspack, Rsbuild, Rolldown, esbuild, Farm, Bun) |
|---|---|---|
| React JSX/TSX | **Integrated** — overlay, task endpoint, and source anchors | **Available with setup** — adapter and JSX/TSX source transform; add the client script manually and ensure Visdiff runs before the framework compiler |
| Vue 3 SFC | **Integrated** — overlay, task endpoint, and template source anchors | **Overlay only** — add the client script manually; Vue template anchors are not added |
| Svelte 4/5 | **Integrated** — overlay, task endpoint, and markup source anchors | **Overlay only** — add the client script manually; Svelte markup anchors are not added |
| Angular templates | **Not integrated** | **Overlay only** — add the client script manually; no Angular template source anchors |

“Integrated” describes the implemented Vite code path, not a claim that every framework version, plugin combination, or application has a separate end-to-end test. When source anchors are unavailable, task capture still includes the rendered element context and observed CSS edits. Runtime-created DOM may also lack a source location.

## Vite

The Vite plugin works with the framework plugin already used by the project. Add it before that plugin:

### React

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visdiffVite } from 'visdiff/vite'

export default defineConfig({
  plugins: [visdiffVite(), react()],
})
```

### Vue

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { visdiffVite } from 'visdiff/vite'

export default defineConfig({
  plugins: [visdiffVite(), vue()],
})
```

### Svelte

```ts
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { visdiffVite } from 'visdiff/vite'

export default defineConfig({
  plugins: [visdiffVite(), svelte()],
})
```

Place Visdiff before the framework plugin so source markers are added before compilation.

For Vue and Svelte, keep the project's existing Vue/Svelte Vite plugin after `visdiffVite()`. Visdiff adds the same `data-visdiff-src` metadata to template elements without requiring edits to components or templates. The relevant framework compiler is loaded only when Visdiff transforms that framework's files.

## Generic bundler adapters

Generic adapter entrypoints are available for Rollup, Webpack, Rspack, Rsbuild, Rolldown, esbuild, Farm, and Bun:

```ts
import { visdiffWebpack } from 'visdiff/webpack'

export default {
  plugins: [visdiffWebpack({ enabled: true })],
}
```

Generic adapters do not inject HTML. Add a development-only script using the endpoint URL printed when the server starts:

```html
<script defer src="http://127.0.0.1:9090/__visdiff/client.js"></script>
```

For React JSX/TSX, the generic adapter can add source anchors when its transform runs before the framework compiler. These adapters do not add Vue or Svelte template anchors. Plugin integration, client-script loading, and queue writes must be verified for the specific bundler setup.

All adapters and source instrumentation are development-only. Turbopack is not supported.
