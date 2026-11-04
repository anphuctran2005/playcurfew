import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    // Tailwind runs through the Vite plugin. An inline config stops Vite from walking up
    // and loading the Next.js app's postcss.config.mjs at the repo root.
    css: { postcss: { plugins: [] } },
    plugins: [react(), tailwindcss()]
  }
})
