# Production scope

This repository is the **Next.js application** only: `app/`, `components/`, `hooks/`, `lib/`, `prisma/`, `config/`, `public/`.

## Intentionally kept (not runtime, but required)

| Path                      | Why it stays                                                      |
| ------------------------- | ----------------------------------------------------------------- |
| `.github/`                | CI/CD — build, lint, test, security gates                         |
| `.husky/`                 | Pre-commit secret scan + lint-staged                              |
| `tests/`, `__tests__/`    | Jest suite (3,600+ tests); required before merge                  |
| `deployment/`             | Docker sandbox for integration tests                              |
| `supabase/`               | Edge functions + SQL archive (auth uses `@supabase/*` at runtime) |
| `.claude/`, `.cursor/`    | Agent/IDE tooling for Unite Group dev workflow                    |
| `.planning/`              | Route reference + phase plans                                     |
| `.storybook/`, `stories/` | Component development (not deployed)                              |

## Removed sidecars (Jul 2026)

Python services, Remotion cron workspace, legacy SQL tree, and duplicate root agent folders — see [`docs/archive/README.md`](../archive/README.md).

## Database

**Prisma only** for application data access. Legacy hand-written SQL is archived under `docs/archive/legacy-database/` and `supabase/archive/`.
