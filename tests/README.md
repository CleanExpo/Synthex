# Synthex Tests

## Autonomous pipeline smoke tests (SYN-590)

`tests/pipelines/*.smoke.test.ts` are **blocking** CI smoke tests for the three
autonomous pipelines that run against real client data without a human in the
loop. They exist to catch the Board Session 13 failure mode that ordinary error
monitoring cannot see: a pipeline that returns **HTTP 200 but a structurally /
semantically empty result** (null caption content, a blank review draft, a
zero-length signals array). Those runs look healthy while damaging client
marketing content — no 401/429/timeout ever fires.

| Pipeline            | Smoke test                          | Production endpoint / unit                                                 | Emptiness guard asserted                                                                                       |
| ------------------- | ----------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Auto-Calendar       | `auto-calendar.smoke.test.ts`       | `lib/calendar/generateWeeklyCalendar` (via `/api/cron/generate-calendars`) | success + non-empty `calendar_posts`, `content` non-null/non-empty string, `scheduled_for` valid ISO timestamp |
| Review Intelligence | `review-intelligence.smoke.test.ts` | `POST /api/internal/generate-review-responses`                             | HTTP 200, `responses_drafted > 0`, `draft_response` string length > 20                                         |
| Seasonal Engine     | `seasonal-engine.smoke.test.ts`     | `POST /api/internal/update-seasonal-signals`                               | HTTP 200, `upserted > 0`, every signal has a non-null `opportunity_name` and a valid `peak_date`               |

### These are smoke tests, not integration tests

They assert **structural validity** of each pipeline's happy-path output — not
content quality, not cross-subsystem data flow, not edge cases. Full
behaviour-level integration tests (calendar → first win → authority score) are
a Sprint 4 Week 2 follow-on (SYN-588).

### Test client fixture (mocked — industry `trades`, state `NSW`)

To keep the suite fast, deterministic, and free of a live database dependency,
the pipelines' external calls (Supabase, the AI caption/reply models, the
nager.date holiday API, the Trends/ABS adapters) are **mocked in-test** rather
than exercised against a seeded Supabase dev row. The mocked fixture represents
a single test client:

- **Org / client id:** `smoke-test-org-trades-nsw`
- **Industry:** `trades`
- **State:** `NSW`
- **Brand profile:** `Test Trades Co`, tone "professional and reassuring"
- **Seeded post:** ≥1 prior post (digest signal source for Auto-Calendar)
- **Seeded review:** one pending `gbp_reviews` row (5★, burst-pipe comment) for
  Review Intelligence

The org id is the single source of truth for the fixture and is referenced by
all three smoke tests. If a live Supabase dev seed is later added, reuse this id.

### Running

```bash
# All smoke tests (also runs as part of `npm test`)
npx jest --config config/jest/jest.worktree.cjs tests/pipelines --no-coverage

# The whole unit suite (CI `test` job)
npm test
```

### CI wiring — blocking, no bypass

- The smoke tests match the discovery pattern in **both** `jest.config.cjs`
  (`testMatch`) and `jest.worktree.cjs` (`testRegex`), so `npm test` runs them.
- `.github/workflows/ci.yml` runs them in the `test` job **and** in a dedicated
  `pipeline-smoke` job. Neither uses `continue-on-error`, so a failure fails the
  build and blocks PR merge.
- There is **no `--skip-ci` flag or exception path** — a failed smoke test
  blocks the PR regardless of what code changed (including RBAC PRs).
