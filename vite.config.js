import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  plugins: [
    tailwindcss(),
  ],
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
})
