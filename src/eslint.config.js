import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  // NUCLEAR IGNORE: Block ALL_CAPS files before any processing
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "**/*.md",
      "**/*.md.jsx",
      "**/*.md.tsx",
      "**/*.md.js",
      // Regex-style: Any file starting with 2+ uppercase + underscore pattern
      "**/[A-Z][A-Z_]*.jsx",
      "**/[A-Z][A-Z_]*.tsx",
      "**/[A-Z][A-Z_]*.js",
      "**/[A-Z][A-Z_]*.ts",
      // Explicit prefixes
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