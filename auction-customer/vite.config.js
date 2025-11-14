import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const sharedPath = path.resolve(__dirname, '../shared')

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': sharedPath
    }
  },
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: 'https://unsynchronous-theresia-indefinite.ngrok-free.dev/',
        changeOrigin: true,
        secure: false,
      }
    },
    fs: {
      allow: [sharedPath, __dirname, path.resolve(__dirname, '..')]
    }
  }
})
