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
      "**/*.md",
      "**/*.md.*",
      
      // Bloqueio total de análises: qualquer arquivo em components que comece com [A-Z]{2,}
      "src/components/**/*[A-Z][A-Z]*.jsx",
      "src/components/**/*[A-Z][A-Z]*.tsx", 
      "src/components/**/*[A-Z][A-Z]*.js",
      "src/components/**/*[A-Z][A-Z]*.ts",
      
      // Bloqueio de todos os padrões conhecidos - todos os prefixos
      "src/**/ANALISE_*",
      "src/**/APLICAVEL_*",
      "src/**/ARQUITETURA_*",
      "src/**/COMPARACAO_*",
      "src/**/COMPARATIVO_*",
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