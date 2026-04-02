import js from '@eslint/js';

export default [
  {
    ignores: [
      // Arquivos de documentação markdown convertidos - não são componentes React
      'src/components/**/*.md.jsx',
      'src/components/**/ANALISE_*.jsx',
      'src/components/**/ARQUITETURA_*.jsx',
      'src/components/**/APLICAVEL_*.jsx',
      'src/components/**/COMPARATIVO_*.jsx',
      'src/components/**/CONFIRMACAO_*.jsx',
      'src/components/**/DECISAO_*.jsx',
      'src/components/**/DIAGNOSTICO_*.jsx',
      'src/components/**/ESTRATEGIA_*.jsx',
      'src/components/**/FLUXO_*.jsx',
      'src/components/**/MAPEAMENTO_*.jsx',
      'src/components/**/MELHORIAS_*.jsx',
      'src/components/**/PLANO_*.jsx',
      'src/components/**/PRINCIPIO_*.jsx',
      'src/components/**/PROJETO_*.jsx',
      'src/components/**/RECONCILIACAO_*.jsx',
      'src/components/**/VALIDACAO_*.jsx',
      'src/functions/**/*.md.jsx',
      'src/**/*.md.jsx',
    ],
  },
];