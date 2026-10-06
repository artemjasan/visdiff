import * as _unplugin from 'unplugin';
import { UnpluginFactory } from 'unplugin';
import { V as VisdiffOptions } from './types-e6fgRmBJ.js';

/**
 * Universal unplugin: works on Vite, Rollup, Webpack, Rspack, Rsbuild, Rolldown, esbuild, Farm, Bun.
 * Starts one shared endpoint server (default http://127.0.0.1:9090) and serves the overlay client.
 * Script injection is bundler-specific: on Vite prefer `visdiffVite` (see ./vite); elsewhere add
 * `<script defer src="http://127.0.0.1:<port>/__visdiff/client.js"></script>` to the dev page.
 * The generic adapter starts only when NODE_ENV=development unless `enabled: true` is passed.
 */
type VisdiffFactory = UnpluginFactory<VisdiffOptions | undefined>;
declare const unpluginFactory: VisdiffFactory;
declare const unplugin: _unplugin.UnpluginInstance<VisdiffOptions | undefined, boolean>;

export { type VisdiffFactory, unplugin as default, unplugin, unpluginFactory };
