import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import { base44 } from '@base44/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    base44({
      // Desabilitar geração de wrappers JSX para .md e .ts
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
  },
  assetsInclude: ['**/*.md'],
  optimizeDeps: {
    exclude: [],
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