import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  // BLOQUEIO TOTAL: Ignorar QUALQUER arquivo que cause parsing errors
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".git/**",
      ".env*",
      // Ignorar todos os arquivos .md e variantes
      "**/*.md",
      "**/*.md.*",
      "**/*.md.jsx",
      "**/*.md.tsx",
      // Ignorar TODOS os arquivos com nomes em MAIÚSCULAS (documentação)
      // Padrão: qualquer arquivo cujo nome começa com letra maiúscula seguida de _ ou maiúsculas
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
      "**/VERIFICACAO_*",
      "**/LINHA_LOGICA_*",
      "**/IMPLEMENTACAO_*",
      "**/ONDE_VER_*",
      "**/CONTRATO_*",
    ],
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        Promise: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        FormData: "readonly",
        File: "readonly",
        Blob: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        process: "readonly",
        __dirname: "readonly",
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": "warn",
      "no-undef": "warn",
    },
  },
];