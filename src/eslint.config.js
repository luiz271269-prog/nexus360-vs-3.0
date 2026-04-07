import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    // Ignorar tudo exceto arquivos JS/JSX/TS/TSX com nomes válidos (minúsculas ou PascalCase normal)
    // Isso exclui arquivos ALL_CAPS de documentação como ANALISE_*, ARQUITETURA_*, etc.
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".git/**",
      // Qualquer arquivo .md ou .md.jsx/.md.tsx
      "**/*.md",
      "**/*.md.js",
      "**/*.md.jsx",
      "**/*.md.ts",
      "**/*.md.tsx",
    ],
  },
  {
    // Só aplicar lint em arquivos JS/JSX/TS/TSX com nomes que NÃO sejam ALL_CAPS_WITH_UNDERSCORES
    // Usamos um padrão negativo: só processa arquivos cujo nome não começa com maiúsculas seguidas de _ 
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: [
      // Padrões ALL_CAPS - documentação disfarçada de componente
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
      "src/**/VERIFICACAO_*",
      "src/**/LINHA_LOGICA_*",
      "src/**/IMPLEMENTACAO_*",
      "src/**/ONDE_VER_*",
      "src/**/CONTRATO_*",
    ],
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