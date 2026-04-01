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
      // Ignorar arquivos .md nas pastas de componentes para evitar
      // hot-reload desnecessário e erros de lint em loop
      ignored: [
        '**/src/**/*.md',
        '**/src/**/ANALISE_*.jsx',
        '**/src/**/ARQUITETURA_*.jsx',
        '**/src/**/PLANO_*.jsx',
        '**/src/**/COMPARACAO_*.jsx',
        '**/src/**/VALIDACAO_*.jsx',
        '**/src/**/DIAGNOSTICO_*.jsx',
        '**/src/**/FLUXO_*.jsx',
        '**/src/**/MAPEAMENTO_*.jsx',
        '**/src/**/CONTRATO_*.jsx',
        '**/src/**/DECISAO_*.jsx',
        '**/src/**/APLICAVEL_*.jsx',
        '**/src/**/CONFIRMACAO_*.jsx',
        '**/src/**/PROJETO_*.jsx',
        '**/src/**/MELHORIAS_*.jsx',
        '**/src/**/RECONCILIACAO_*.jsx',
        '**/src/**/PRINCIPIO_*.jsx',
        '**/src/**/ESTRATEGIA_*.jsx',
      ],
    },
  },
})