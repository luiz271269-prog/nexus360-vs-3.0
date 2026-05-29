import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Keep this value in sync when we intentionally need to invalidate Vite's
// pre-bundled dependency cache. The React null-dispatcher/useState crash can
// happen when the browser/dev server mixes stale optimized React chunks.
const VITE_REACT_CACHE_BUST = 'react-singleton-2026-05-29'

// https://vite.dev/config/
export default defineConfig({
  cacheDir: `node_modules/.vite-${VITE_REACT_CACHE_BUST}`,
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true'
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    force: true,
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
})
