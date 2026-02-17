# Phase 2: Mock Data — API Routes - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<vision>
## How This Should Work

Every API route that currently returns fake data (Math.random(), hardcoded arrays, stub responses) gets replaced with real Prisma queries against the Supabase database. This isn't just a find-and-replace — each endpoint should become production-solid while we're in there: proper error handling, meaningful empty states, and clean responses.

The competitor tracking cron is the top priority because it runs every 30 minutes and is actively polluting the database with fake data. Stop the bleeding there first, then work through the rest.

When an endpoint has no real data (e.g. user hasn't set up competitors yet), it returns an empty array with a hint message like "No competitors tracked yet" — let the frontend handle the CTA. Never fake the data.

</vision>

<essential>
## What Must Be Nailed

- **Competitor cron fixed first** — it's actively generating fake data every 30 min in production
- **Every mock replaced with real queries** — zero Math.random() or hardcoded arrays left in API routes
- **Production-solid endpoints** — proper error handling, meaningful empty states with hints, clean responses

</essential>

<boundaries>
## What's Out of Scope

- No UI/dashboard component changes — that's Phase 3
- API routes only — services and lib/ code can change as needed to support real queries
- Don't add new endpoints or capabilities beyond what exists

</boundaries>

<specifics>
## Specific Ideas

- Empty responses should include a hint message (e.g. `{ data: [], message: "No competitors tracked yet" }`)
- Fix + improve: don't just swap the mock, make the endpoint production-ready while touching it
- Endpoint-by-endpoint, surgical approach — but improve error handling as we go

</specifics>

<notes>
## Additional Context

The 5-plan structure from the roadmap makes sense:
1. Competitor tracking (critical — cron active)
2. Content generation mock persona
3. Content library and research endpoints
4. Monitoring, SEO, and integration stubs
5. Full endpoint audit (grep for remaining mock patterns)

</notes>

---

*Phase: 02-mock-data-api*
*Context gathered: 2026-02-16*
