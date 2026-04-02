import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "**/*.md",
      "**/*.md.jsx",
      "**/*.md.tsx",
      "**/*.md.js",
      // All uppercase analysis/documentation files
      "**/[A-Z]*_*.jsx",
      "**/[A-Z]*_*.js",
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
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
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
    },
  },
];