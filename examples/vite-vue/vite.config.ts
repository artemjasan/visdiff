import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { visdiffVite } from 'visdiff/vite'

export default defineConfig({
  plugins: [visdiffVite(), vue()],
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
})
