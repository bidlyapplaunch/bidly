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
  build: {
    rollupOptions: {
      output: {
        // Code-split heavy third-party deps out of the single ~605KB app bundle
        // so they can be cached independently. Behavior is unchanged.
        manualChunks: {
          react: ['react', 'react-dom'],
          polaris: ['@shopify/polaris'],
          socket: ['socket.io-client']
        }
      }
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
