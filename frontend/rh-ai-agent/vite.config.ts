import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true, 
    proxy: {
      '/api': {
        target: 'https://487x6hb3-8000.euw.devtunnels.ms',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path, 
      },
    },
  },
  preview: {
    port: 5173,
  },
})