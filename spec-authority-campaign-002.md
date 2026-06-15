---
spec_type: child
spec_id: spec-authority-campaign-002
parent: spec-master-agency-001            # spec.md §8 item #2
title: "Wire the authority-campaign generator into a real, persisted, org-scoped route"
version: 0.1.0
date: 2026-06-16
status: draft — awaiting human approval (no code yet)
australian_context: true
inherits:
  - .claude/skills/fable-engine/SKILL.md
  - .claude/rules/fabel-evidence-standard.md
  - .claude/rules/verification-gate.md
overridden_by:
  - CONSTITUTION.md
backlog_ref: "spec.md §7 row 11 · §8 #2 · §15 (#2 live proof)"
---

# Child Spec #2 — Wire the Authority-Campaign Generator

## 1. Finish line (locked)

> **Done when** an authenticated, org-scoped POST request produces a **real,
> DB-persisted authority campaign** — the deterministic `generateFullAuthorityCampaign`
> output saved to a campaign row and returned with its **database id** (not the mock
> fixture) — validated by Zod, scoped to the caller's effective organisation, and
> covered by an integration test asserting the `401 → 403 → 400 → 200` ladder plus a
> persisted, non-mock row.

`[STATUS] finish-line: locked`

Rejected finish lines: (a) "expose the generator as a pure compute endpoint that returns
the pack without persisting" — fails §8 #2's "DB-backed … a Campaign DB id"; (b) "replace
the mock demo route" — violates §13 ("the demo route stays mock and must not be sold").

---

## 2. Decision up front

Add **one new route** — `POST /api/marketing-agency/campaigns/authority` — built with the
repo's `defineRoute` + `withAuth` contract (exactly as the sibling
[agents route](app/api/marketing-agency/agents/route.ts) does). It Zod-validates the campaign
brief, derives the `business` block from the caller's org, calls the **pure** generator,
persists the result to a **`MarketingAgencyCampaign`** row (with `providerMode: 'live'` and
the full pack on `metadata` JSON), optionally writes the campaign's
`sources` as `MarketingAgencySourceRef` rows, and returns `{ id, pack }`. The existing mock
route is left untouched. **No new Prisma columns and no migration are required** if the pack
is stored on the existing `metadata Json?` field.

`[INFERENCE]` This is the smallest change that satisfies both Gate-A acceptance (#2) and the
§13 "demo stays mock" constraint, and it reuses the module's own purpose-built model rather
than overloading the generic publishing `Campaign` table.

---

## 3. Three corrections (verified this pass)

Per §6 / §9 (audits over-report; verify before build), this pass corrected two parent-spec
assumptions and one of its own draft assumptions:

1. `[VERIFIED]` **No AI integration — drop P4.** `generateFullAuthorityCampaign`
   ([full-campaign-generator.ts:506](lib/marketing-agency/full-campaign-generator.ts)) is a
   **pure, synchronous** function: `(input: AuthorityCampaignInput) => AuthorityCampaignPack`.
   A grep for `getAIProvider|anthropic|openai|prisma|async|await|fetch(` over the whole 689-line
   file returns **zero** matches. The master spec tagged #2 as **P3/P4 (API + AI integration)**;
   the real work is **P3 only** (route + persistence). There is no model call to route, no cost
   guardrail to add, no provider-factory seam.
2. `[INFERENCE]` **Persistence target is `MarketingAgencyCampaign`, not the generic `Campaign`.**
   §8 #2 says "a Campaign DB id"; the architecturally correct home is the module's own model
   ([schema.prisma:3285](prisma/schema.prisma)) — it already carries `providerMode`
   (default `"mock"`), `metadata Json?`, `boardMemo Json?`, a `@@unique([organizationId, slug])`,
   and `sourceRefs`/`claims`/`assets` relations that match the generator's output. The generic
   `Campaign` table ([schema.prisma:273](prisma/schema.prisma)) is the social-publishing concept
   (`platform`, `Post[]`). See Open Question Q1.
3. `[VERIFIED]` **The non-mock `providerMode` is `'live'`, not `'authority'`.** This draft first
   guessed `"authority"`; the type is `ProviderMode = 'mock' | 'live'`
   ([types.ts:1](lib/marketing-agency/types.ts)) and the dashboard only renders the string
   (`{campaign.providerMode}`) — no filter logic — so the row is written with `providerMode: 'live'`.

---

## 4. Goals & non-goals

**Goals**
- One real, persisted, org-scoped route that returns a DB id for a generated authority campaign.
- Zod-validated brief; `{ error, details? }` error shape; `401 → 403 → 400 → 200` ordering.
- An integration test that proves the ladder and a non-mock persisted row.

**Non-goals**
- Touching or deleting the mock demo route (`campaigns/route.ts`) — it stays mock (§13).
- Changing the generator's logic (it is verified-correct and script/test-covered).
- Any AI/provider wiring (corrected away in §3.1).
- A list/detail/UI surface for authority campaigns — separate slice; this is the write path only.
- A schema migration, **unless** Q2 resolves toward a dedicated column.

---

## 5. Approach (plain language)

The generator already does the hard work; it's just never been called from the product. So we
build the thinnest possible bridge: a POST route that (1) authenticates and resolves the org via
the existing `withAuth` `clientId`, (2) validates a small campaign brief with Zod, (3) assembles
the generator's rich `AuthorityCampaignInput` — pulling the `business` block from the org's brand
context and taking `objective`, `operatingMandate`, `sources`, `channels`, `horizonDays` from the
brief, (4) calls the pure `generateFullAuthorityCampaign`, (5) writes a `MarketingAgencyCampaign`
row (provider mode flagged non-mock, pack on `metadata`) plus its `MarketingAgencySourceRef` rows
in one transaction, and (6) returns the new row id and the pack. The mock route is left exactly
as-is so nothing sellable changes behaviour.

---

## 6. Phased plan (smallest slice first)

| Phase | Map | Work | Definition of done |
|---|---|---|---|
| **P-data** | P2 | Confirm persistence target (Q1) + storage field (Q2). If `metadata` JSON → **no migration**. If a dedicated `authorityPack Json?` column → additive, nullable, via Supabase `apply_migration` (never `prisma db push`). | `npx prisma validate` clean; no destructive change; decision recorded |
| **P-route** | P3 | New `app/api/marketing-agency/campaigns/authority/route.ts` POST via `defineRoute` + `withAuth`. Zod brief schema. Resolve `business` from org (Q3). Call generator. Persist `MarketingAgencyCampaign` (+ `MarketingAgencySourceRef`, Q5) in a `prisma.$transaction`. Return `{ id, pack }`. | Route returns a real DB id; mock route untouched; `{error,details?}` on bad input |
| **P-test** | P6 | Integration test: `401` (no session) → `403` (no/invalid org) → `400` (bad body) → `200` (persisted, `providerMode !== 'mock'`, id present). | `npm test` green for the new suite; ladder asserted against real Prisma |

No later phase starts before the earlier DoD is met. P-route does not begin until Q1–Q3 are answered.

---

## 7. Data model

`[VERIFIED]` Reuse existing models — **no new model**:
- **`MarketingAgencyCampaign`** ([schema.prisma:3285](prisma/schema.prisma)) — required fields to
  satisfy on create: `organizationId`, `createdById`, `name`, `slug` (unique per org),
  `productName`, `primaryOffer`. Set `providerMode: 'live'` (the typed non-mock value).
  Store the `AuthorityCampaignPack` on `metadata` (or `boardMemo`). The `business` block is derived
  from `Organization` + `BrandDNA` (`brandVoice`/`persona`/`offerings` JSON); body fallback if the
  org has no `BrandDNA`.
- **`MarketingAgencySourceRef`** ([schema.prisma:3320](prisma/schema.prisma)) — one row per
  `input.sources[]` entry (`label`, `url`/`path`, `sourceType`), org-scoped, FK to the campaign.

Migration rule: if Q2 selects a dedicated column, it is **nullable/defaulted and additive only**,
applied via `apply_migration`; existing columns are never dropped/renamed/retyped. `npx prisma
validate` before any change.

---

## 8. Security & cost guardrails (structural)

`[VERIFIED]` — derived from the sibling route pattern:
- **Auth**: Supabase-only via `withAuth`; `clientId` is the effective org id. Never trust an
  `organizationId` from the body for scoping — persist under `clientId`.
- **Org-scoping**: every write carries `organizationId: clientId`; the `@@unique([organizationId,
  slug])` prevents cross-org slug collision. The integration test must prove **403 on a missing/
  invalid org context** (no unscoped write).
- **Input**: Zod on the body; cap `sources` length, `horizonDays` range, and string sizes to bound
  the synchronous compute (the generator loops `horizonDays`).
- **Secrets/cost**: none — no external call, no AI spend, no new env var, no new npm package.
- **SSRF note**: `sources[].url` is **stored only**, never fetched by this route — no
  `validateExternalUrl` needed here (flag if a later slice fetches them).

---

## 9. Risk & assumption register

| Tag | Item | Mitigation |
|---|---|---|
| `[VERIFIED]` | Generator is pure/sync — no AI, no DB, no async (whole-file grep clean) | P4 dropped; spec scoped to P3 only |
| `[INFERENCE]` | `MarketingAgencyCampaign` is the right home (has `providerMode`, `metadata`, `sourceRefs`) | Q1 ratifies; fallback to generic `Campaign` is low-cost |
| `[VERIFIED]` | Brand/`business` source exists: `Organization` + `BrandDNA` (`brandVoice`/`persona`/`offerings`) | Resolved — derive in P-route; body fallback if no `BrandDNA` |
| `[VERIFIED]` | `providerMode = 'mock' \| 'live'`; UI only displays it | Resolved — write `'live'` |
| `[VERIFIED]` | §13 forbids changing the demo route | New path; mock route untouched |

---

## 10. Open questions (2 genuine decisions — answer before P-route)

Q3, Q4 from the draft are **resolved by code** (§3.3, §9): `business` derives from
`Organization` + `BrandDNA`; `providerMode: 'live'`. The two remaining are yours:

1. **Q1 — Persist to `MarketingAgencyCampaign` (recommended) or the generic `Campaign`?**
   Recommend `MarketingAgencyCampaign` (module-native, `providerMode`, `sourceRefs`).
2. **Q2 — Store the pack on existing `metadata Json?` (recommended, zero migration) or add a
   dedicated nullable `authorityPack Json?` column (more queryable, needs `apply_migration`)?**
   Recommend `metadata` for v1.

**Non-blocking default (proceed unless you object):** also persist `MarketingAgencySourceRef`
rows from the campaign's `sources[]` — the relation exists and feeds the claims pipeline.

---

## 11. Verification plan (the exact commands that prove "done")

```bash
npx prisma validate                         # only if Q2 → schema change; must be clean
npm run type-check                          # tsc --noEmit — zero errors
npm run lint                                # ESLint --max-warnings 0
npm test -- app/api/marketing-agency/campaigns/authority   # the new integration suite, green
```

**Per-item live proof (master spec §15 #2):** the route returns a **DB id**, not the mock fixture.

```bash
# authenticated POST (cookie/JWT) — happy path
curl -s -X POST http://localhost:3000/api/marketing-agency/campaigns/authority \
  -H "Content-Type: application/json" -b "<auth-cookie>" \
  -d '{"name":"Authority Q3","objective":"...","operatingMandate":"...","sources":[{"id":"s1","label":"...","sourceType":"internal_policy","path":"..."}],"horizonDays":14}'
# MUST return a real "id" (cuid) and a "pack" with a non-empty calendar; NOT the mock package.
```

Then prove persistence: a follow-up read (Prisma Studio or a list query) shows the row with
`providerMode !== 'mock'`. The integration test encodes the full `401 → 403 → 400 → 200` ladder
so "green" is the `Tests:` line, not an assertion.

---

`[STATUS] gate: awaiting approval` — nothing builds until Q1–Q4 are answered and this spec is
approved. P-deploy/prod remains the founder's call.
