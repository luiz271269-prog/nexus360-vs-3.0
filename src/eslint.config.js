export default [
  {
    // Só processa arquivos que parecem componentes/páginas válidos
    // Ignora tudo que começa com maiúsculas seguidas de underscore (docs/análises)
    ignores: [
      '**/*.md',
      '**/*.md.jsx',
      '**/*.md.tsx',
      // Padrões de arquivos de documentação/análise com nomes em SCREAMING_SNAKE_CASE
      // Qualquer arquivo cujo nome (sem path) contém underscore entre palavras maiúsculas
      '**/[A-Z]*_[A-Z]*.jsx',
      '**/[A-Z]*_[A-Z]*.tsx',
      '**/[A-Z]*_[A-Z]*.js',
      // Prefixos específicos conhecidos
      '**/ANALISE_*',
      '**/ARQUITETURA_*',
      '**/APLICAVEL_*',
      '**/COMPARATIVO_*',
      '**/COMPARACAO_*',
      '**/CONFIRMACAO_*',
      '**/DECISAO_*',
      '**/DIAGNOSTICO_*',
      '**/ESTRATEGIA_*',
      '**/FLUXO_*',
      '**/MAPEAMENTO_*',
      '**/MELHORIAS_*',
      '**/PLANO_*',
      '**/PRINCIPIO_*',
      '**/PROJETO_*',
      '**/RECONCILIACAO_*',
      '**/VALIDACAO_*',
    ],
  },
];