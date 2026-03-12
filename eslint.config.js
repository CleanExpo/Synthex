import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.next-alt/**',
      '.next-analyze/**',
      '.next-dev/**',
      'packages/**/dist/**',
      'out/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'Synthex/**',
      'with-turbopack-app/**',
      '.turbo/**',
      'public/**',
      'scripts/**',
      'stories/**',
      '.storybook/**',
      'storybook-static/**',
      // Legacy/scaffold directories — not part of the production app
      '_framework/**',
      'agents/**',
      'api.legacy/**',
      'database/**',
      'deployment/**',
      'config/**',
      'templates/**',
      'prisma/seed.js',
      // Source scaffold (Express/standalone server, not Next.js app)
      'src/**',
      // Root-level test + ops scripts
      'test-*.js',
      'test-*.ts',
      'monitoring/**',
      'sdk/**',
      'tests/e2e/**',
      'tests/k6/**',
      'tests/api/**',
      'tests/setup.js',
      'playwright-continuous-test.js',
      'test-server.js',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // Warn on console statements - use lib/logger.ts instead
      'no-console': ['warn', { allow: ['warn', 'error', 'debug', 'info'] }],
      // Suppress noisy style rules (pre-existing across codebase)
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
  // Allow console, require(), and module assignment in utility/test files
  {
    files: ['lib/logger.ts', 'scripts/**/*', 'tests/**/*'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@next/next/no-assign-module-variable': 'off',
    },
  },
];

export default eslintConfig;
