# Framework and bundler support

Vite injects the overlay and endpoint. Generic adapters require a manual client script. Source anchors vary by framework:

## Support matrix

| Framework | Vite | Generic adapters |
|---|---|---|
| React JSX/TSX | Overlay, endpoint, and source anchors | Adapter + manual client; anchors if Visdiff runs before the framework compiler |
| Vue 3 SFC | Overlay, endpoint, and template anchors | Adapter + manual client; no template anchors |
| Svelte 4/5 | Overlay, endpoint, and markup anchors | Adapter + manual client; no markup anchors |
| Angular templates | Not integrated | Adapter + manual client; no template anchors |

Anchors may be unavailable for runtime-created DOM. Without an anchor, tasks still include rendered element context and observed CSS edits.

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

Keep the existing framework plugin after `visdiffVite()`. No component markers are required.

## Generic bundler adapters

Entry points are available for Rollup, Webpack, Rspack, Rsbuild, Rolldown, esbuild, Farm, and Bun. For example:

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

For React JSX/TSX, source anchors require the Visdiff transform to run before the framework compiler. Generic adapters do not add Vue or Svelte template anchors.

All adapters and source instrumentation are development-only. Verify client loading and queue writes in the target bundler. Turbopack is not supported.
