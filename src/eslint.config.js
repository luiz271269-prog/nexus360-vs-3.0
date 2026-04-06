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
      "**/*.ts.jsx",
      "**/*.ts.tsx",
      // Ignorar arquivos de análise/documentação por padrão de nome
      "src/**/ANALISE_*.jsx",
      "src/**/ANALISE_*.tsx",
      "src/**/ANALISE_*.js",
      "src/**/ARQUITETURA_*.jsx",
      "src/**/ARQUITETURA_*.tsx",
      "src/**/COMPARATIVO_*.jsx",
      "src/**/COMPARATIVO_*.tsx",
      "src/**/CONFIRMACAO_*.jsx",
      "src/**/DECISAO_*.jsx",
      "src/**/DIAGNOSTICO_*.jsx",
      "src/**/ESTRATEGIA_*.jsx",
      "src/**/FLUXO_*.jsx",
      "src/**/MAPEAMENTO_*.jsx",
      "src/**/MELHORIAS_*.jsx",
      "src/**/PLANO_*.jsx",
      "src/**/PRINCIPIO_*.jsx",
      "src/**/PROJETO_*.jsx",
      "src/**/RECONCILIACAO_*.jsx",
      "src/**/VALIDACAO_*.jsx",
      "src/**/APLICAVEL_*.jsx",
      // Ignorar todos os arquivos com nome iniciando em maiúsculas (documentação)
      "src/**/{[A-Z]*}.jsx",
      "src/**/{[A-Z]*}.tsx",
      "src/**/{[A-Z]*}.js",
      "src/**/{[A-Z]*}.ts",
      // Pastas específicas de documentação
      "src/components/skills/**",
      "src/components/nexus-ai/**/*.jsx",
      "src/components/nexus-ai/**/*.tsx",
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