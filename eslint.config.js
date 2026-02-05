import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // Warn on console statements - use lib/logger.ts instead
      'no-console': ['warn', { allow: ['warn', 'error', 'debug', 'info'] }],
    },
  },
  // Allow console in specific utility files
  {
    files: ['lib/logger.ts', 'scripts/**/*', 'tests/**/*'],
    rules: {
      'no-console': 'off',
    },
  },
];

export default eslintConfig;
