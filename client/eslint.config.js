// ESLint configuration for EfSec TypeScript client
// Ensures TypeScript code quality and consistency

import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      
      // General code quality
      'no-console': ['error', { allow: ['error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': 'error',
      'curly': 'error',
      
      // Security
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',
      
      // Performance  
      'no-loop-func': 'error',
      'no-await-in-loop': 'warn',
      
      // Maintainability
      'complexity': ['warn', { max: 10 }],
      'max-depth': ['warn', { max: 4 }],
      'max-lines': ['warn', { max: 300, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 50, skipComments: true }],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      // Relax some rules for test files
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines-per-function': 'off',
      'complexity': 'off',
    },
  },
];