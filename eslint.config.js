import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const designBaseline = require('./config/eslint-design-baseline.json');

const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.vercel/**',
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
      '.artifacts/**',
      '.handoff-logs/**',
      'Synthex/**',
      'services/**',
      'with-turbopack-app/**',
      '.turbo/**',
      'public/**',
      'scripts/**',
      'playwright-report/**',
      'test-results/**',
      '.claude/**',
      '.worktrees/**',
      'docs/archive/**',
      'config/**',
      'prisma/seed.js',
      'lib/marketing-intelligence/**',
      'supabase/functions/**',
      'test-*.js',
      'test-*.ts',
      'tests/e2e/**',
      'tests/k6/**',
      'tests/api/**',
      'tests/setup.js',
      'tmp/**',
      'src/**',
      '.superpowers/**',
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
      'no-console': ['warn', { allow: ['warn', 'error', 'debug', 'info'] }],
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
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
  {
    files: ['lib/logger.ts', 'scripts/**/*', 'tests/**/*'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@next/next/no-assign-module-variable': 'off',
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "JSXElement[openingElement.name.name='button'] JSXElement[openingElement.name.name='Link']",
          message:
            'Do not nest <Link> (renders <a>) inside <button> — invalid HTML and a known source of React.Children.only errors. Use <Link> styled as a button via sidebarMenuButtonVariants, or <Button asChild><Link/></Button>.',
        },
        {
          selector:
            'Literal[value=/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-fA-F])/]',
          message:
            'No raw hex colors in components — use a design token (e.g. brand.primary / text-orange-400) defined in app/globals.css. See .claude/rules/frontend/nextjs.md.',
        },
        {
          selector:
            'TemplateElement[value.raw=/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-fA-F])/]',
          message:
            'No raw hex colors in components — use a design token (e.g. brand.primary / text-orange-400) defined in app/globals.css. See .claude/rules/frontend/nextjs.md.',
        },
        {
          selector: 'Literal[value=/text-\\[(?:[0-9]|10)px\\]/]',
          message:
            'No sub-11px font sizes — text-[10px] and smaller hurt accessibility. Use text-xs (12px) or larger. See .claude/rules/frontend/nextjs.md.',
        },
        {
          selector: 'TemplateElement[value.raw=/text-\\[(?:[0-9]|10)px\\]/]',
          message:
            'No sub-11px font sizes — text-[10px] and smaller hurt accessibility. Use text-xs (12px) or larger. See .claude/rules/frontend/nextjs.md.',
        },
      ],
    },
  },
  {
    files: designBaseline.rawHexOnly,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "JSXElement[openingElement.name.name='button'] JSXElement[openingElement.name.name='Link']",
          message:
            'Do not nest <Link> (renders <a>) inside <button> — invalid HTML and a known source of React.Children.only errors. Use <Link> styled as a button via sidebarMenuButtonVariants, or <Button asChild><Link/></Button>.',
        },
        {
          selector: 'Literal[value=/text-\\[(?:[0-9]|10)px\\]/]',
          message:
            'No sub-11px font sizes — text-[10px] and smaller hurt accessibility. Use text-xs (12px) or larger. See .claude/rules/frontend/nextjs.md.',
        },
        {
          selector: 'TemplateElement[value.raw=/text-\\[(?:[0-9]|10)px\\]/]',
          message:
            'No sub-11px font sizes — text-[10px] and smaller hurt accessibility. Use text-xs (12px) or larger. See .claude/rules/frontend/nextjs.md.',
        },
      ],
    },
  },
  {
    files: designBaseline.subElevenOnly,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "JSXElement[openingElement.name.name='button'] JSXElement[openingElement.name.name='Link']",
          message:
            'Do not nest <Link> (renders <a>) inside <button> — invalid HTML and a known source of React.Children.only errors. Use <Link> styled as a button via sidebarMenuButtonVariants, or <Button asChild><Link/></Button>.',
        },
        {
          selector:
            'Literal[value=/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-fA-F])/]',
          message:
            'No raw hex colors in components — use a design token (e.g. brand.primary / text-orange-400) defined in app/globals.css. See .claude/rules/frontend/nextjs.md.',
        },
        {
          selector:
            'TemplateElement[value.raw=/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-fA-F])/]',
          message:
            'No raw hex colors in components — use a design token (e.g. brand.primary / text-orange-400) defined in app/globals.css. See .claude/rules/frontend/nextjs.md.',
        },
      ],
    },
  },
  {
    files: designBaseline.both,
    rules: {
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
];

export default eslintConfig;
