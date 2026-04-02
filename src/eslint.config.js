import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  // MÁXIMA PRIORIDADE: Ignorar TUDO que corresponde ao padrão [A-Z]{2,}.*
  {
    ignores: [
      // Standard ignores
      "node_modules/**",
      "dist/**",
      "build/**",
      ".git/**",
      ".env*",
      "**/*.md",
      "**/*.md.jsx",
      "**/*.md.tsx",
      "**/*.md.js",
      "**/*.md.ts",
      
      // CRITICAL: Bloqueia todos os arquivos que começam com 2+ letras maiúsculas
      // Pattern: ANALISE_*, ARQUITETURA_*, APLICAVEL_*, COMPARATIVO_*, etc.
      "**/*[A-Z][A-Z]*.jsx",
      "**/*[A-Z][A-Z]*.tsx",
      "**/*[A-Z][A-Z]*.js",
      "**/*[A-Z][A-Z]*.ts",
      
      // Diretório inteiro src/components (se houver subpasta)
      "src/components/*[A-Z][A-Z]*.jsx",
      "src/components/*[A-Z][A-Z]*.tsx",
      "src/components/comunicacao/*[A-Z][A-Z]*.jsx",
      "src/components/comunicacao/*[A-Z][A-Z]*.tsx",
      "src/components/**/*[A-Z][A-Z]*.jsx",
      "src/components/**/*[A-Z][A-Z]*.tsx",
      
      // Explícito: cada prefixo
      "src/**/ANALISE_*",
      "src/**/ARQUITETURA_*",
      "src/**/APLICAVEL_*",
      "src/**/COMPARATIVO_*",
      "src/**/COMPARACAO_*",
      "src/**/CONFIRMACAO_*",
      "src/**/DECISAO_*",
      "src/**/DIAGNOSTICO_*",
      "src/**/ESTRATEGIA_*",
      "src/**/FLUXO_*",
      "src/**/MAPEAMENTO_*",
      "src/**/MELHORIAS_*",
      "src/**/PLANO_*",
      "src/**/PRINCIPIO_*",
      "src/**/PROJETO_*",
      "src/**/RECONCILIACAO_*",
      "src/**/VALIDACAO_*",
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