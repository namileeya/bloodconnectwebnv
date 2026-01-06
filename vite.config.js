import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: 'bloodconnectwebnv-1.onrender.com',
    host: '0.0.0.0',
    port: 10000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})