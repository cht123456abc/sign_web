import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // Print LAN IPs at startup so mobile devices can connect.
    // Vite will print these automatically when host is 0.0.0.0.
  },
  optimizeDeps: {
    // pdf.js ships a worker file that we import with ?url suffix.
    // Including it here ensures Vite pre-bundles the worker correctly.
    include: ['pdfjs-dist/build/pdf.mjs'],
  },
  worker: {
    format: 'es',
  },
})