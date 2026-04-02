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
      // Aggressive ignore for ALL_CAPS documentation/analysis files
      "**/*[A-Z][A-Z0-9_]{3,}*.jsx",
      "**/*[A-Z][A-Z0-9_]{3,}*.tsx",
      "**/*[A-Z][A-Z0-9_]{3,}*.js",
      "**/*.md.jsx",
      "**/*.md.tsx",
      "**/*.md.js",
    ],
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: [
      "**/*[A-Z][A-Z0-9_]{3,}*.jsx",
      "**/*[A-Z][A-Z0-9_]{3,}*.tsx",
      "**/*.md.jsx",
      "**/*.md.tsx",
      "src/components/**/*[A-Z][A-Z0-9_]*.jsx",
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