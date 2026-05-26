import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: './',  // GitHub Pages用の相対パス設定
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        real: resolve(__dirname, 'real.html')
      }
    }
  }
})