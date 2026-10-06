import { Plugin } from 'vite';
import { V as VisdiffOptions } from './types-e6fgRmBJ.js';

/**
 * First-class Vite adapter: same-origin overlay
 * (script injection + /__visdiff endpoints live inside the dev server, no extra port).
 */
declare function visdiffVite(options?: VisdiffOptions): Plugin;

export { visdiffVite as default, visdiffVite };
