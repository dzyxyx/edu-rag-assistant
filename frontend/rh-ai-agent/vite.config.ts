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
    host: true, // важно для доступа из локальной сети
    // 🔥 Проксирование API-запросов на бэкенд (devtunnels)
    proxy: {
      '/api': {
        target: 'https://487x6hb3-8000.euw.devtunnels.ms',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path, // не меняем путь
      },
    },
  },
  preview: {
    port: 5173,
  },
})