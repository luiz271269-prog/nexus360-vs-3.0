import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import { base44 } from '@base44/vite-plugin'

const VITE_REACT_CACHE_BUST = 'react-singleton-2026-05-29'

export default defineConfig({
  cacheDir: `../node_modules/.vite-${VITE_REACT_CACHE_BUST}`,
  plugins: [
    react(),
    base44({
      legacySDKImports: true,
      autoGenerateWrappers: false,
      excludePatterns: [
        '**/*.md',
        '**/*.md.jsx',
        '**/*.md.tsx',
        '**/*.ts.jsx',
        '**/*.ts.tsx',
      ]
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  assetsInclude: ['**/*.md'],
  optimizeDeps: {
    force: true,
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    exclude: [],
    // bump para forçar re-otimização limpa do cache .vite (corrige mismatch de cópias do React)
    force: true,
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('use client')) return;
        warn(warning);
      },
    },
  },
  // Excluir arquivos de documentação ALL_CAPS do processamento
  server: {
    fs: {
      strict: false,
    },
  },
});