import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

// Phone / browser build of the same UI (PWA). Relative base: works on any path, e.g. GitHub Pages.
export default defineConfig({
  root: resolve('src/web'),
  base: './',
  publicDir: resolve('src/web/public'),
  envDir: resolve('.'),
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: { alias: { '@shared': resolve('src/shared'), '@': resolve('src/renderer/src') } },
  plugins: [react()],
  build: {
    outDir: resolve('dist-web'),
    emptyOutDir: true,
    target: ['es2022', 'safari16'],
    reportCompressedSize: false,
  },
  server: { port: 5180 },
  preview: { port: 5181, strictPort: true },
})
