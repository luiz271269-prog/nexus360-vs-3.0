const emptyParser = {
  parse: () => ({
    type: 'Program',
    body: [],
    sourceType: 'module',
    range: [0, 0],
    loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
    tokens: [],
    comments: [],
  }),
};

const DOC_GLOBS = [
  "**/*.md.jsx", "**/*.md.tsx", "**/*.md.js",
  "**/ANALISE_*.jsx", "**/ANALISE_*.tsx", "**/ANALISE_*.js",
  "**/ARQUITETURA_*.jsx", "**/ARQUITETURA_*.tsx", "**/ARQUITETURA_*.js",
  "**/APLICAVEL_*.jsx", "**/APLICAVEL_*.tsx", "**/APLICAVEL_*.js",
  "**/COMPARATIVO_*.jsx", "**/COMPARATIVO_*.tsx", "**/COMPARATIVO_*.js",
  "**/COMPARACAO_*.jsx", "**/COMPARACAO_*.tsx", "**/COMPARACAO_*.js",
  "**/CONFIRMACAO_*.jsx", "**/CONFIRMACAO_*.tsx", "**/CONFIRMACAO_*.js",
  "**/DECISAO_*.jsx", "**/DECISAO_*.tsx", "**/DECISAO_*.js",
  "**/DIAGNOSTICO_*.jsx", "**/DIAGNOSTICO_*.tsx", "**/DIAGNOSTICO_*.js",
  "**/ESTRATEGIA_*.jsx", "**/ESTRATEGIA_*.tsx", "**/ESTRATEGIA_*.js",
  "**/FLUXO_*.jsx", "**/FLUXO_*.tsx", "**/FLUXO_*.js",
  "**/MAPEAMENTO_*.jsx", "**/MAPEAMENTO_*.tsx", "**/MAPEAMENTO_*.js",
  "**/MELHORIAS_*.jsx", "**/MELHORIAS_*.tsx", "**/MELHORIAS_*.js",
  "**/PLANO_*.jsx", "**/PLANO_*.tsx", "**/PLANO_*.js",
  "**/PRINCIPIO_*.jsx", "**/PRINCIPIO_*.tsx", "**/PRINCIPIO_*.js",
  "**/PROJETO_*.jsx", "**/PROJETO_*.tsx", "**/PROJETO_*.js",
  "**/RECONCILIACAO_*.jsx", "**/RECONCILIACAO_*.tsx", "**/RECONCILIACAO_*.js",
  "**/VALIDACAO_*.jsx", "**/VALIDACAO_*.tsx", "**/VALIDACAO_*.js",
  "**/VALIDACAO_ANTIRACE_*.jsx", "**/VALIDACAO_ANTIRACE_*.tsx",
  "**/COMPARACAO_*.jsx", "**/COMPARACAO_*.tsx",
];

export default [
  {
    ignores: DOC_GLOBS,
  },
  {
    files: DOC_GLOBS,
    languageOptions: { parser: emptyParser },
    rules: {},
  },
];