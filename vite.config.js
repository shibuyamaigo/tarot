import { defineConfig } from 'vite'

export default defineConfig({
  base: './',  // GitHub Pages用の相対パス設定
  build: {
    outDir: 'dist'
  }
})