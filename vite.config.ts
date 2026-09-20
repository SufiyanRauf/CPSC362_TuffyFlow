import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Tailwind v4 is a Vite plugin. There is no tailwind.config.js and no postcss.config.js.
// If you find instructions telling you to run `npx tailwindcss init`, they are for v3.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Lets `npm run dev` reach a locally running Python scorer.
    // Only needed if you run uvicorn yourself instead of using `vercel dev`.
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
