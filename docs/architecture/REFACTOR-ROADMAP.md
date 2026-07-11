# Enterprise Refactor Roadmap

Phased plan to reach a production-grade, minimal-root Next.js codebase without breaking live functionality.

## Principles

1. **No behaviour changes** unless fixing a verified bug
2. **Verify after every phase**: `type-check`, `lint`, `test`, `build:vercel`
3. **One concern per PR** — easier review and rollback
4. **Follow existing patterns** — see `docs/architecture/README.md` and `architecture-enforcer` skill

---

## Phase 1 — Foundation (current)

- [x] Canonical architecture documentation (`docs/architecture/`)
- [x] Remove committed build artifacts (`storybook-static/`)
- [x] Remove legacy root test scripts (superseded by Jest/Playwright)
- [x] Relocate root specs/SQL to `docs/` and `supabase/archive/`
- [x] Consolidate runtime JSON config under `config/`
- [x] Standardise TypeScript path aliases
- [x] Add `lib/db/` re-export barrel for database access

## Phase 2 — Dependency & dead code audit

```bash
npx depcheck
npx knip  # if added
npm audit --omit=dev
```

- Remove unused npm packages (document bundle impact per CONSTITUTION)
- Delete unreferenced exports in `lib/` and `components/`
- Archive `agents/`, `skills/`, `synthex-bayesian-service/` if confirmed unused at runtime

## Phase 3 — `lib/` domain boundaries

- Group flat files at `lib/` root into domain folders
- Ensure each API route delegates to exactly one service module
- Expand `lib/services/index.ts` barrel for public service surface

## Phase 4 — Component hygiene

- Audit duplicate UI (search for copy-pasted card/list/modal patterns)
- Enforce `@/components/icons` barrel (no direct `lucide-react` in features)
- Replace hardcoded hex colours with design tokens (P6 — phase 82-03)

## Phase 5 — Type safety & API contracts

- Eliminate `any` in `app/api/` (SYN-57)
- Migrate remaining routes to `lib/api/define-route.ts`
- Centralise auth via `getAuthenticatedUser` / `APISecurityChecker`

## Phase 6 — Test & CI alignment

- Single Playwright config (`playwright.config.ts`)
- Remove duplicate Jest configs where safe
- Per-path coverage floors in `jest.worktree.cjs`

---

## Root directory target state

```
├── CONSTITUTION.md, CLAUDE.md, README.md, LICENSE, CHANGELOG.md
├── package.json, package-lock.json
├── next.config.mjs, proxy.ts, instrumentation.ts
├── tsconfig.json, eslint.config.js, tailwind.config.cjs, postcss.config.cjs
├── jest.worktree.cjs, playwright.config.ts
├── vercel.json, prisma.config.ts
├── .env.example, .gitignore, components.json
└── (tooling dotfiles: .npmrc, .nvmrc, .prettierrc, …)
```

Everything else lives in `app/`, `lib/`, `config/`, `docs/`, `scripts/`, or `.planning/`.
