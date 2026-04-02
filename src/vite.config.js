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
  assetsInclude: ['**/*.md'],
  optimizeDeps: {
    exclude: [],
  },
  server: {
    watch: {
      // Ignorar arquivos de documentação: .md, .md.jsx, e arquivos MAIÚSCULOS sem extensão
      ignored: [
        '**/*.md',
        '**/*.md.jsx',
        // Arquivos sem extensão com nome em MAIÚSCULAS (padrão ANALISE_*, ARQUITETURA_*, etc)
        (filePath) => {
          const basename = filePath.split('/').pop();
          return /^[A-Z][A-Z0-9_]{3,}$/.test(basename);
        },
      ],
    },
  },
  build: {
    rollupOptions: {
      external: (id) => {
        const basename = id.split('/').pop();
        return /^[A-Z][A-Z0-9_]{3,}$/.test(basename) ||
               /[A-Z_]{4,}.*\.jsx$/.test(id) ||
               id.endsWith('.md');
      },
    },
  },
})