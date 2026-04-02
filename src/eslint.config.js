// Parser vazio para arquivos de documentação (markdown disfarçado de JSX)
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

// Lista de prefixos de arquivos de documentação
const DOC_FILE_PATTERNS = [
  "**/*.md.jsx",
  "**/*.md.tsx",
  "**/*.md.js",
  "**/ANALISE_*.jsx",
  "**/ANALISE_*.tsx",
  "**/ANALISE_*.js",
  "**/ARQUITETURA_*.jsx",
  "**/ARQUITETURA_*.tsx",
  "**/APLICAVEL_*.jsx",
  "**/COMPARATIVO_*.jsx",
  "**/COMPARACAO_*.jsx",
  "**/CONFIRMACAO_*.jsx",
  "**/DECISAO_*.jsx",
  "**/DIAGNOSTICO_*.jsx",
  "**/ESTRATEGIA_*.jsx",
  "**/FLUXO_*.jsx",
  "**/MAPEAMENTO_*.jsx",
  "**/MELHORIAS_*.jsx",
  "**/PLANO_*.jsx",
  "**/PRINCIPIO_*.jsx",
  "**/PROJETO_*.jsx",
  "**/RECONCILIACAO_*.jsx",
  "**/VALIDACAO_*.jsx",
];

export default [
  // Bloco de ignores global (deve ser o primeiro e único com a chave ignores)
  {
    ignores: [
      "**/*.md.jsx",
      "**/*.md.tsx",
      "**/*.md.js",
      "**/ANALISE_*",
      "**/ARQUITETURA_*",
      "**/APLICAVEL_*",
      "**/COMPARATIVO_*",
      "**/COMPARACAO_*",
      "**/CONFIRMACAO_*",
      "**/DECISAO_*",
      "**/DIAGNOSTICO_*",
      "**/ESTRATEGIA_*",
      "**/FLUXO_*",
      "**/MAPEAMENTO_*",
      "**/MELHORIAS_*",
      "**/PLANO_*",
      "**/PRINCIPIO_*",
      "**/PROJETO_*",
      "**/RECONCILIACAO_*",
      "**/VALIDACAO_*",
    ],
  },
  // Fallback: parser vazio para qualquer arquivo doc que passe
  {
    files: DOC_FILE_PATTERNS,
    languageOptions: {
      parser: emptyParser,
    },
    rules: {},
  },
];