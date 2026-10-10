import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visdiffVite } from 'visdiff/vite'

export default defineConfig({
  plugins: [visdiffVite(), tailwindcss(), react()],
  server: { host: '127.0.0.1', port: 5176, strictPort: true },
})
