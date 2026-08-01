import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/manojgemini/',
  plugins: [react()],
  build: {
    rollupOptions: {
      external: [
        'fs', 'path', 'url', 'module', 'events', 'util', 'stream', 'buffer', 'string_decoder',
        'node:fs', 'node:path', 'node:url', 'node:module', 'node:events', 'node:util', 'node:stream'
      ],
    },
  },
})