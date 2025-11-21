import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const sharedPath = path.resolve(__dirname, '../shared')
const customerPath = path.resolve(__dirname, '../auction-customer/src')
const polarisPath = path.resolve(__dirname, 'node_modules/@shopify/polaris')

// Read API keys from all TOML files
function getApiKeysFromToml() {
  const apiKeys = []
  const tomlFiles = [
    path.resolve(__dirname, '../shopify.app.bidly.toml'),
    path.resolve(__dirname, '../shopify.app.second.toml'),
    path.resolve(__dirname, '../shopify.app.toml')
  ]
  
  for (const tomlPath of tomlFiles) {
    if (fs.existsSync(tomlPath)) {
      const content = fs.readFileSync(tomlPath, 'utf-8')
      const match = content.match(/client_id\s*=\s*"([^"]+)"/)
      if (match && match[1]) {
        apiKeys.push(match[1])
      }
    }
  }
  
  // Return the first one found (or null if none)
  return apiKeys.length > 0 ? apiKeys[0] : null
}

const apiKey = getApiKeysFromToml()

// Vite plugin to inject API key into HTML
function injectApiKeyPlugin() {
  return {
    name: 'inject-api-key',
    transformIndexHtml(html) {
      if (apiKey) {
        // Inject API key into the script tag
        return html.replace(
          /<script>\s*\/\/ Try to extract API key from URL/,
          `<script>
      // Injected API key from TOML file
      window.SHOPIFY_API_KEY = '${apiKey}';
      const metaTag = document.querySelector('meta[name="shopify-api-key"]');
      if (metaTag) {
        metaTag.setAttribute('content', '${apiKey}');
      }
      // Try to extract API key from URL (Shopify embedded apps include it)`
        )
      }
      return html
    }
  }
}

export default defineConfig({
  plugins: [react(), injectApiKeyPlugin()],
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
  },
  define: {
    // Inject API key as environment variable
    'import.meta.env.VITE_SHOPIFY_API_KEY': JSON.stringify(apiKey || '')
  }
})
