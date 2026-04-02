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
      
      // Bloqueio total de análises/documentação gerada automaticamente
      "src/**/*ANALISE*.{jsx,tsx,js,ts}",
      "src/**/*APLICAVEL*.{jsx,tsx,js,ts}",
      "src/**/*ARQUITETURA*.{jsx,tsx,js,ts}",
      "src/**/*COMPARACAO*.{jsx,tsx,js,ts}",
      "src/**/*COMPARATIVO*.{jsx,tsx,js,ts}",
      "src/**/*CONFIRMACAO*.{jsx,tsx,js,ts}",
      "src/**/*DECISAO*.{jsx,tsx,js,ts}",
      "src/**/*DIAGNOSTICO*.{jsx,tsx,js,ts}",
      "src/**/*ESTRATEGIA*.{jsx,tsx,js,ts}",
      "src/**/*FLUXO*.{jsx,tsx,js,ts}",
      "src/**/*MAPEAMENTO*.{jsx,tsx,js,ts}",
      "src/**/*MELHORIAS*.{jsx,tsx,js,ts}",
      "src/**/*PLANO*.{jsx,tsx,js,ts}",
      "src/**/*PRINCIPIO*.{jsx,tsx,js,ts}",
      "src/**/*PROJETO*.{jsx,tsx,js,ts}",
      "src/**/*RECONCILIACAO*.{jsx,tsx,js,ts}",
      "src/**/*VALIDACAO*.{jsx,tsx,js,ts}",
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