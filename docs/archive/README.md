# Archived / removed from active development

These directories were removed from the production Next.js codebase to reduce root clutter. They are **not** deployed to Vercel and are **not** imported by `app/`, `lib/`, or `components/`.

| Path                              | Reason removed                                                            |
| --------------------------------- | ------------------------------------------------------------------------- |
| `legacy-database/`                | Pre-Prisma SQL migrations; superseded by `prisma/migrations/`             |
| `plans/`, `specs/`                | Duplicate planning docs; canonical plans live in `.planning/` and `docs/` |
| Python `brand-intelligence/`      | Standalone pipeline; no runtime import in Next.js app                     |
| `synthex-bayesian-service/`       | FastAPI sidecar; not wired into Vercel deploy                             |
| `board-cron/`                     | Remotion render workspace; orphaned from main build                       |
| `marketing-studio/`               | External Pi-CEO research substrate; not app runtime                       |
| Root `agents/`, `skills/`, `src/` | Agent markdown / skill specs; runtime agents live in `lib/agents/`        |

If you need historical SQL, see `legacy-database/migrations/` and `../supabase/archive/`.
