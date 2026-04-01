import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { base44 } from '@base44/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    base44(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // ─────────────────────────────────────────────────────────────────
  // PREVINE que arquivos .md e arquivos de análise/documentação dentro
  // de src/ sejam processados pelo bundler como módulos JavaScript/JSX.
  // Esses arquivos são apenas documentação de referência.
  // ─────────────────────────────────────────────────────────────────
  assetsInclude: ['**/*.md'],
  optimizeDeps: {
    exclude: [],
  },
  server: {
    watch: {
      // Ignorar TODOS os arquivos de documentação para evitar lint loop
      ignored: [
        '**/src/**/*.md',
        '**/src/**/*.md.jsx',
        /src[\\/].*[A-Z_]{4,}.*\.jsx$/,
      ],
    },
  },
  build: {
    rollupOptions: {
      external: (id) => /[A-Z_]{4,}.*\.jsx$/.test(id) || id.endsWith('.md'),
    },
  },
})