import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// Regex to match documentation/analysis files with ALL_CAPS_UNDERSCORE naming
const isDocFile = (filePath) => {
  const basename = filePath.split('/').pop() || '';
  // Matches: ANALISE_*.jsx, ARQUITETURA_*.jsx, PLANO_*.jsx, etc. (all-caps with underscores)
  // Also matches *.md.jsx double-extension files
  return /^[A-Z][A-Z0-9_]{3,}.*\.(jsx?|tsx?)$/.test(basename) || 
         /\.md\.(jsx?|tsx?)$/.test(basename);
};

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "**/*.md",
      // All uppercase documentation/analysis component files
      "src/**/*.md.jsx",
      "src/**/*.md.tsx",
      "src/**/*.md.js",
      "src/**/[A-Z][A-Z]*_*.jsx",
      "src/**/[A-Z][A-Z]*_*.js",
      "src/**/[A-Z][A-Z]*_*.tsx",
      // Explicit prefixes that keep reappearing
      "src/**/ANALISE_**",
      "src/**/ARQUITETURA_**",
      "src/**/APLICAVEL_**",
      "src/**/COMPARATIVO_**",
      "src/**/COMPARACAO_**",
      "src/**/CONFIRMACAO_**",
      "src/**/DECISAO_**",
      "src/**/DIAGNOSTICO_**",
      "src/**/ESTRATEGIA_**",
      "src/**/FLUXO_**",
      "src/**/MAPEAMENTO_**",
      "src/**/MELHORIAS_**",
      "src/**/PLANO_**",
      "src/**/PRINCIPIO_**",
      "src/**/PROJETO_**",
      "src/**/RECONCILIACAO_**",
      "src/**/VALIDACAO_**",
    ],
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: [
      // Double-ignore inside the files block for extra coverage
      "src/**/*.md.jsx",
      "src/**/*.md.tsx",
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