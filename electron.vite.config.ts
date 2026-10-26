import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = { '@shared': resolve('src/shared') }

// Everything is bundled (no runtime node_modules in the package): smaller installer, faster cold start.
export default defineConfig({
  main: {
    resolve: { alias: shared },
    build: { externalizeDeps: false, minify: true, rollupOptions: { input: resolve('src/main/index.ts') } },
  },
  preload: {
    resolve: { alias: shared },
    build: {
      externalizeDeps: false,
      minify: true,
      rollupOptions: {
        input: resolve('src/preload/index.ts'),
        // Sandboxed preloads must be CommonJS.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: resolve('src/renderer'),
    resolve: { alias: { ...shared, '@': resolve('src/renderer/src') } },
    plugins: [react()],
    build: {
      target: 'chrome140',
      minify: true,
      cssCodeSplit: true,
      reportCompressedSize: false,
      rollupOptions: { input: resolve('src/renderer/index.html') },
    },
  },
})
