import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: "/manojgemini/", // <-- Right here! The slashes go at the start and end of your repo name.
  plugins: [react()],
})
