import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // <--- Make sure this is imported

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // <--- Make sure this plugin is added here
  ],
})