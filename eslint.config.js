import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.next2 /**',
      '.next-alt/**',
      '.next-analyze/**',
      '.next-dev/**',
      '.next-turbo/**',
      '.next_alt /**',
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
      'playwright-report/**',
      'test-results/**',
      // Claude working directories — archived scripts and scratchpads
      '.claude/**',
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
      // Temporary utility/migration scripts — not part of the production app
      'tmp/**',
      // Claude superpowers / skill-runner scripts — not part of the production app
      '.superpowers/**',
      // Board cron — standalone Node.js scripts for Remotion video generation
      // These are not Next.js app code and use console.log intentionally
      'board-cron/**',
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
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
      // React Compiler rules (new in eslint-config-next v16) — suppressed until Plan 02
      // These fire widely across pre-existing codebase; fixing requires dedicated refactor plan
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
      // SYN-905: forbid <Link> nested inside <button>. <Link> renders an
      // anchor; anchors cannot descend from buttons per WHATWG spec, and
      // the structure is a known source of React.Children.only crashes
      // when a Slot somewhere up the tree clones the wrapper. Use either
      // (a) <Link> styled as a button via sidebarMenuButtonVariants, or
      // (b) <Button asChild><Link/></Button> if a Button wrapper is
      // semantically right. See plan: abstract-roaming-feigenbaum.md §C.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "JSXElement[openingElement.name.name='button'] JSXElement[openingElement.name.name='Link']",
          message:
            'Do not nest <Link> (renders <a>) inside <button> — invalid HTML and a known source of React.Children.only errors. Use <Link> styled as a button via sidebarMenuButtonVariants, or <Button asChild><Link/></Button>.',
        },
      ],
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
