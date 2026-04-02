import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".git/**",
      ".env*",
      "**/*.md",
      "**/*.md.*",
      
      // Bloqueio agressivo: ignorar TODOS os arquivos com nomes em ALL_CAPS
      "src/**/*[A-Z][A-Z]*",
      "src/**/*ANALISE*",
      "src/**/*APLICAVEL*",
      "src/**/*ARQUITETURA*",
      "src/**/*COMPARACAO*",
      "src/**/*COMPARATIVO*",
      "src/**/*CONFIRMACAO*",
      "src/**/*DECISAO*",
      "src/**/*DIAGNOSTICO*",
      "src/**/*ESTRATEGIA*",
      "src/**/*FLUXO*",
      "src/**/*MAPEAMENTO*",
      "src/**/*MELHORIAS*",
      "src/**/*PLANO*",
      "src/**/*PRINCIPIO*",
      "src/**/*PROJETO*",
      "src/**/*RECONCILIACAO*",
      "src/**/*VALIDACAO*",
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