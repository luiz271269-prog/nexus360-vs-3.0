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

export default [
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
];