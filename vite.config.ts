import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: './' なので GitHub Pages などのサブパスにそのまま置ける
export default defineConfig({
  base: '/test-play-app/',
  plugins: [react(), tailwindcss()],
})
