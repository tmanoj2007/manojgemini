import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { builtinModules } from 'module'

const allExternal = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)]

export default defineConfig({
  base: '/manojgemini/',
  plugins: [react()],
  build: {
    rollupOptions: {
      external: ['fsevents', ...allExternal],
    },
  },
})