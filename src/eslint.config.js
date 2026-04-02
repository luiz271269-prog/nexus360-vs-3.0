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
      "src/**/*.md.jsx",
      "src/**/*.md.tsx",
      "src/**/*.md.js",
      // Ignore all uppercase analysis/documentation files
      "src/**/ANALISE_*.jsx",
      "src/**/ANALISE_*.js",
      "src/**/ARQUITETURA_*.jsx",
      "src/**/ARQUITETURA_*.js",
      "src/**/APLICAVEL_*.jsx",
      "src/**/APLICAVEL_*.js",
      "src/**/COMPARATIVO_*.jsx",
      "src/**/COMPARATIVO_*.js",
      "src/**/COMPARACAO_*.jsx",
      "src/**/COMPARACAO_*.js",
      "src/**/CONFIRMACAO_*.jsx",
      "src/**/CONFIRMACAO_*.js",
      "src/**/DECISAO_*.jsx",
      "src/**/DECISAO_*.js",
      "src/**/DIAGNOSTICO_*.jsx",
      "src/**/DIAGNOSTICO_*.js",
      "src/**/ESTRATEGIA_*.jsx",
      "src/**/ESTRATEGIA_*.js",
      "src/**/FLUXO_*.jsx",
      "src/**/FLUXO_*.js",
      "src/**/MAPEAMENTO_*.jsx",
      "src/**/MAPEAMENTO_*.js",
      "src/**/MELHORIAS_*.jsx",
      "src/**/MELHORIAS_*.js",
      "src/**/PLANO_*.jsx",
      "src/**/PLANO_*.js",
      "src/**/PRINCIPIO_*.jsx",
      "src/**/PRINCIPIO_*.js",
      "src/**/PROJETO_*.jsx",
      "src/**/PROJETO_*.js",
      "src/**/RECONCILIACAO_*.jsx",
      "src/**/RECONCILIACAO_*.js",
      "src/**/VALIDACAO_*.jsx",
      "src/**/VALIDACAO_*.js",
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