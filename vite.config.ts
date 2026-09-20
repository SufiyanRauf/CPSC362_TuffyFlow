import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Tailwind v4 is a plugin here, no tailwind.config.js needed
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // so npm run dev can reach uvicorn running on 8000
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
