# Legacy src/ Directory

This directory previously contained legacy code from the original architecture.

All active code has been migrated to `lib/` as of 22/03/2026 (UNI-1619).

Archive location: `.claude/archived/2026-03-22/legacy-src/`

## Migration Map

| Old Location                                   | New Location                          |
| ---------------------------------------------- | ------------------------------------- |
| `src/services/ai/persona-training-pipeline.ts` | `lib/ai/persona-training-pipeline.ts` |
| `src/services/ai/content-variations.ts`        | `lib/ai/content-variations.ts`        |
| `src/middleware/cache-middleware.ts`           | `lib/middleware/cache-middleware.ts`  |
| `src/middleware/session.ts`                    | `lib/middleware/session.ts`           |
| `src/services/content/calendar-service.ts`     | `lib/content/calendar-service.ts`     |
| `src/services/analytics/report-builder.ts`     | `lib/analytics/report-builder.ts`     |
| `src/config/redis.config.ts`                   | `lib/config/redis.config.ts`          |
