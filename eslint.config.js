import globals from 'globals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  {
    ignores: ['dist/**', 'scripts/temp/**'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // Custom rule to prevent inefficient array spreading with Math.max/min
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='Math'][callee.property.name=/^(max|min)$/] > SpreadElement",
          message:
            'Avoid using Math.max(...array) or Math.min(...array) as it can cause stack overflow with large arrays. Use a more efficient approach like a for loop or reduce().',
        },
        {
          selector:
            "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message:
            'Direct Math.random() usage is not allowed. Use RandomNumberGenerator interface instead for dependency injection and testability. Only allowed in DefaultRandomNumberGenerator and test code.',
        },
      ],
    },
  },
  {
    // Allow Math.random() in DefaultRandomNumberGenerator and test files
    files: ['src/grain-generator.ts', 'test/**/*.ts', '**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='Math'][callee.property.name=/^(max|min)$/] > SpreadElement",
          message:
            'Avoid using Math.max(...array) or Math.min(...array) as it can cause stack overflow with large arrays. Use a more efficient approach like a for loop or reduce().',
        },
        // Math.random() is allowed in test files and grain-generator.ts
      ],
    },
  },
];
