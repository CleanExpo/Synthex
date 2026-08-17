import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// WS3 design-token guardrails. Existing violators are pinned in this baseline
// so the ban on raw #hex / sub-11px font sizes blocks NEW violations without
// failing CI on the ~390-file existing backlog. Burn the lists down over time;
// never hand-add files.
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
      // Local run artefacts — gitignored, so CI never sees them and lints green
      // while a developer machine that has run a browser audit or an overnight
      // job lints red on vendored junk it did not write. That divergence makes
      // the local gate untrustworthy, which is worse than no local gate.
      '.artifacts/**',
      '.handoff-logs/**',
      'Synthex/**',
      // Standalone deployables with their own package.json + deploy lifecycle
      // (e.g. the Railway media-worker) — not part of the Next.js app.
      'services/**',
      'with-turbopack-app/**',
      '.turbo/**',
      'public/**',
      'scripts/**',
      'playwright-report/**',
      'test-results/**',
      // Claude working directories — archived scripts and scratchpads
      '.claude/**',
      // Nested git worktrees (SYN-1070 workflow) — gitignored, never present in
      // CI checkouts; flat config does not read .gitignore, so ignore explicitly
      '.worktrees/**',
      // Archived legacy code & docs — not part of the production app
      'docs/archive/**',
      'config/**',
      'prisma/seed.js',
      'lib/marketing-intelligence/**',
      // Supabase Edge Functions are Deno (Deno.serve, JSR imports) — not the Next.js/Node app
      'supabase/functions/**',
      // Root-level test + ops scripts
      'test-*.js',
      'test-*.ts',
      'tests/e2e/**',
      'tests/k6/**',
      'tests/api/**',
      'tests/setup.js',
      // Temporary utility/migration scripts — not part of the production app
      'tmp/**',
      // Source scaffold removed — keep ignore for stale worktrees
      'src/**',
      // Claude superpowers / skill-runner scripts — not part of the production app
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
  // -------------------------------------------------------------------------
  // WS3 — design-token honesty guardrails (component code only).
  // Bans raw `#hex` colors and sub-11px font sizes so the design tokens stay
  // the single source of truth. ERROR-level (lint runs `--max-warnings 0`, so
  // `warn` would also fail CI — error + a baseline exemption is the only way to
  // block NEW violations while keeping CI green on the existing backlog).
  //
  // NOTE: `no-restricted-syntax` is not additive across config blocks — the
  // last matching block fully replaces the option list. So this block re-states
  // the existing Link-in-<button> guard (from the main rules block) alongside
  // the two new design selectors.
  // -------------------------------------------------------------------------
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
  // Baseline exemptions. `no-restricted-syntax` is replaced wholesale by the last
  // matching block, so each baseline block re-states exactly the guards that
  // should still apply to that file group. The Link-in-<button> guard is always
  // preserved; the design selectors are dropped only for the rule(s) the file
  // already violates. Lists are mutually exclusive (see config/eslint-design-baseline.json).
  // rawHexOnly: drop hex selectors, keep sub-11px guard.
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
  // subElevenOnly: drop sub-11px selectors, keep hex guard.
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
  // both: drop both design selectors, keep only the Link-in-<button> guard.
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
