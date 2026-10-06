import * as esbuild from 'esbuild';
import * as rollup from 'rollup';
import { V as VisdiffOptions } from './types-e6fgRmBJ.js';

/** Generic unplugin adapters. For same-origin Vite middleware, use `visdiff/vite`. */
declare const visdiffRollup: (options?: VisdiffOptions | undefined) => rollup.Plugin<any> | rollup.Plugin<any>[];
declare const visdiffWebpack: (options?: VisdiffOptions | undefined) => WebpackPluginInstance;
declare const visdiffRspack: (options?: VisdiffOptions | undefined) => RspackPluginInstance;
declare const visdiffRsbuild: (options?: VisdiffOptions | undefined) => any;
declare const visdiffRolldown: (options?: VisdiffOptions | undefined) => any;
declare const visdiffEsbuild: (options?: VisdiffOptions | undefined) => esbuild.Plugin;
declare const visdiffFarm: (options?: VisdiffOptions | undefined) => JsPlugin;
declare const visdiffBun: (options?: VisdiffOptions | undefined) => BunPlugin;

export { visdiffBun, visdiffEsbuild, visdiffFarm, visdiffRolldown, visdiffRollup, visdiffRsbuild, visdiffRspack, visdiffWebpack };
