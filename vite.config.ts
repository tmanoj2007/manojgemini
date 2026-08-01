import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/manojgemini/',
  plugins: [react()],
  resolve: {
    alias: {
      'node:path': 'path-browserify',
    },
  },
  build: {
    rollupOptions: {
      external: ['fsevents'],
    },
  },
})