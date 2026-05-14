import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    ...react.configs.flat.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Count JSX component identifiers as "used" (prevents false no-unused-vars on Route/Routes/etc).
      'react/jsx-uses-vars': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Too noisy for FYP/demo; keep correctness via hooks lint + build.
      'react-refresh/only-export-components': 'off',
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^(_|err|error|e)$',
          varsIgnorePattern: '^(_|React)',
          caughtErrorsIgnorePattern: '^(_|err|error|e)$'
        }
      ]
    },
    settings: { react: { version: 'detect' } }
  }
];
