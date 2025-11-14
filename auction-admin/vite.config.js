import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const sharedPath = path.resolve(__dirname, '../shared')
const customerPath = path.resolve(__dirname, '../auction-customer/src')
const polarisPath = path.resolve(__dirname, 'node_modules/@shopify/polaris')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': sharedPath,
      '@customer': customerPath,
      '@shopify/polaris': polarisPath
    }
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'https://bidly-auction-backend.onrender.com/',
        changeOrigin: true
      }
    },
    fs: {
      allow: [sharedPath, customerPath, __dirname, path.resolve(__dirname, '..')]
    }
  },
  build: {
    // Force cache busting
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
})
