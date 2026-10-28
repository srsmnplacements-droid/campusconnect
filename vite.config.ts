import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' lets the site work from any address (GitHub Pages, Cloudflare, etc.)
export default defineConfig({
  base: './',
  plugins: [react()],
})
