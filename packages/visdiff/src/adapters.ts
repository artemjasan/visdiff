import { unplugin } from './plugin'

/** Generic unplugin adapters. For same-origin Vite middleware, use `visdiff/vite`. */
export const visdiffRollup = unplugin.rollup
export const visdiffWebpack = unplugin.webpack
export const visdiffRspack = unplugin.rspack
export const visdiffRsbuild = unplugin.rsbuild
export const visdiffRolldown = unplugin.rolldown
export const visdiffEsbuild = unplugin.esbuild
export const visdiffFarm = unplugin.farm
export const visdiffBun = unplugin.bun
