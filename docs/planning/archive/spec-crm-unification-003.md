---
spec_type: child
spec_id: spec-crm-unification-003
parent: spec-master-agency-001 # spec.md §8 item #3
title: 'Unify the scattered CRM primitives behind the EXISTING Client store + a client console'
version: 0.1.0
date: 2026-06-16
status: draft — awaiting human approval (no code yet); one architectural fork to ratify (§10 Q1)
australian_context: true
inherits:
  - .claude/skills/fable-engine/SKILL.md
  - .claude/rules/fabel-evidence-standard.md
  - .claude/rules/verification-gate.md
overridden_by:
  - CONSTITUTION.md
backlog_ref: 'spec.md v1.3 §7 row 17 · §8 #3 · §11'
---

# Child Spec #3 — Unify CRM primitives + client console

## 1. Finish line (locked)

> **Done when** an authenticated user can open a **client console** (`/dashboard/clients`)
> that lists their organisation's clients and a per-client detail view assembled from the
> EXISTING client store plus the previously-scattered primitives (lead, deliverables, health,
> engagement) — all org-scoped, Zod-validated, reading real data with no mock path — and a
> `Contact` concept links people to a client. Falsifiable: the console renders ≥1 real client
> with its linked primitives; a cross-org request returns `403`.

`[STATUS] finish-line: locked`

## 2. Correction to the master spec (verified this pass — the headline)

`[VERIFIED]` **A `Client` entity already exists; the master spec's "fold into _new_ `Client`/
`Contact` models" is inaccurate.** Evidence:

- `lib/services/client-management.ts` (773 lines) defines a full `Client` domain — `Client`,
  `WorkspaceMember`, `BrandGuidelines`, `WhiteLabelConfig`, `ClientSettings`,
  `ClientAnalyticsSummary` — with org-scoped CRUD, member management and invites.
- It is backed by **Supabase tables `clients` and `client_members`**, accessed via a
  **service-role** client (`supabase.from('clients')`), i.e. **outside Prisma and bypassing RLS**.
- `app/api/clients/route.ts` (518 lines) exposes it but is flagged `@internal … no dashboard
page exists yet. Wire when a /dashboard/clients page is built.`

So #3 is **consolidation + surfacing**, not greenfield:

1. `Client`/`client_members` exist (Supabase-direct, un-Prisma'd, **unwired** to UI).
2. The Prisma primitives are separate and **not linked** to a client: `Lead` (4 product uses),
   `DealDeliverable` (1), `ClientHealthScore` (6), `ClientEngagementEvent` (4).
3. `PipelineCostLedger` has **0 product uses** — schema-only drift; **exclude from #3** (do not
   migrate dead weight).
4. No `Contact` model exists (`rg '^model Contact ' = 0`).

`[INFERENCE]` The real gap is: a console, a `Contact` concept, links from the 4 live primitives
to the existing client, and a decision on whether the Supabase-direct `Client` should be brought
onto the app's Prisma + `withAuth` + RLS architecture.

## 3. Decision up front

Build the `/dashboard/clients` console + its read API on the **existing** client store, add a
`Contact` concept, and link the 4 live primitives to a client by `clientId`. The one consequential
fork is **where `Client` lives** (§10 Q1): **recommend bringing `clients`/`client_members` into
Prisma** (introspect → model the existing tables, additive; migrate the service off raw
service-role access) so the unified CRM is one store with real foreign keys and RLS — consistent
with the rest of Synthex. The lower-risk alternative (keep `Client` Supabase-direct; reference it
by soft `clientId` string) is viable for v1 but perpetuates a cross-store split and the
RLS-bypassing service-role pattern.

## 4. Goals & non-goals

**Goals**

- A real, org-scoped client console (list + detail) reading the existing store, no mock path.
- A `Contact` concept (people belonging to a client).
- The 4 live primitives linked to a client and surfaced in the detail view.

**Non-goals**

- Migrating `PipelineCostLedger` (0 uses — drift; flag for separate cleanup).
- The external white-label/reseller tier (#17, v2) — though `WhiteLabelConfig` already exists on
  the client store, do not build the external tier here.
- Re-platforming ALL Supabase-direct services to Prisma — only `clients`/`client_members` if Q1→A2.
- Deleting/renaming any existing column (migration is additive only).

## 5. Approach (plain language)

The client store and its service already exist; the product just never grew a face for it or
connected the CRM primitives to it. So #3 (a) decides Client's home (Q1), (b) adds a `Contact`
concept and an additive `clientId` link on the 4 live primitives, (c) builds an org-scoped read
API (`defineRoute` + `withAuth`) that assembles a client's detail from the store + its linked
primitives, and (d) renders the `/dashboard/clients` list + detail. Smallest slice first: prove
the read path + console against existing data before adding `Contact` and the primitive links.

## 6. Phased plan (smallest slice first)

| Phase          | Map   | Work                                                                                                                                                                                                                                                                             | Definition of done                                                     |
| -------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **P-decide**   | P2    | Ratify Q1 (Client home: Prisma vs Supabase-direct). If A2 → introspect `clients`/`client_members`, add matching Prisma models (additive, nullable/defaulted) via `apply_migration`.                                                                                              | Q1 ratified; if A2, `npx prisma validate` clean, no destructive change |
| ~~**P-read**~~ | P3    | `[VERIFIED]` **Already exists** — `app/api/clients/route.ts` GET is a full org-scoped read (list `{clients,total}`, single client, members, analytics) via `ClientManagementService`. **No API to build** (building one would duplicate it — the #2 lesson). A1 reuses it as-is. | n/a — reuse existing route                                             |
| **P-console**  | P1    | `/dashboard/clients` list + detail page consuming the existing `GET /api/clients`. **This is the real A1 gap.**                                                                                                                                                                  | Renders ≥1 real client; org-scoped; no mock                            |
| **P-contact**  | P2/P3 | Add `Contact` (people per client) + additive `clientId` on `Lead`/`DealDeliverable`/`ClientHealthScore`/`ClientEngagementEvent`; surface in detail.                                                                                                                              | Additive migration; primitives show under their client                 |

No later phase before the earlier DoD. P-read does not start until Q1 is ratified.

## 7. Data model

`[VERIFIED]` from code (`lib/services/client-management.ts`) — `clients`: `id, organizationId,
name, slug, domain?, logo?, industry?, timezone, brandGuidelines?(json), whiteLabel?(json),
settings(json), status('active'|'paused'|'archived'), createdAt, updatedAt`. `client_members`:
`id, userId, clientId, role, permissions[], invitedAt, acceptedAt?, status`.

- **If Q1→A2:** introspect and add `Client`/`ClientMember` Prisma models matching the live tables
  (no column changes — model what exists), then add new `Contact` + `clientId` FKs.
- **If Q1→A1:** `Client` stays Supabase-direct; `Contact` and the `clientId` links are soft
  references (string `clientId`, no FK constraint across the store boundary).
- New/extended columns nullable or defaulted; applied via Supabase `apply_migration`, never
  `prisma db push`; never drop/rename/retype existing columns without explicit CEO approval.

## 8. Security & cost guardrails (structural)

`[VERIFIED]` / `[INFERENCE]`:

- **RLS-bypass smell:** the client store is reached via the **service-role** key
  (`SUPABASE_SERVICE_ROLE_KEY`), which bypasses RLS; org-scoping is enforced only in app code
  (`.eq('organization_id', …)`). New read routes MUST org-scope by the caller's `clientId`
  (`withAuth`) and prove **403 on cross-org**. Q1→A2 (Prisma + RLS) structurally removes this smell.
- No new external calls, no AI spend, no new npm package, no new infra (`[[use-existing-infra-never-add]]`).
- Secrets stay in Vercel; service-role key never logged.

## 9. Risk & assumption register

| Tag             | Item                                                                                                                          | Mitigation                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `[VERIFIED]`    | `Client` already exists (Supabase `clients`/`client_members` + 773-line service) — master spec #3 framing wrong               | This spec reframes #3 as consolidation; recommend updating master §8 #3 + §7 row 17                         |
| `[VERIFIED]`    | `PipelineCostLedger` 0 product uses                                                                                           | Excluded from #3; flag as drift-cleanup candidate                                                           |
| `[VERIFIED]`    | Client store uses service-role (RLS bypass)                                                                                   | Q1→A2 removes it; either way new routes org-scope + 403 test                                                |
| `[UNCONFIRMED]` | Live `clients`/`client_members` exact columns + row counts (prod read blocked by auto-mode; shape taken from code interfaces) | Confirm via an approved introspection before A2 migration; treat code interfaces as the contract until then |
| `[INFERENCE]`   | A2 migration is additive (model existing tables; no data change)                                                              | `npx prisma validate` + introspection diff before apply                                                     |

## 10. Open questions (the one fork that changes the build, + minor)

1. **Q1 (architectural fork) — where does `Client` live?**
   - **A2 (recommended):** bring `clients`/`client_members` into Prisma (introspect → model,
     additive) and migrate the service to Prisma + RLS. True unification, real FKs, removes the
     service-role/RLS-bypass smell. Higher effort + a (additive) migration on live tables.
   - **A1 (lower-risk):** keep `Client` Supabase-direct; console reads the existing service;
     `Contact` + primitive `clientId` are soft string references. Faster, but perpetuates the
     cross-store split and the RLS-bypass pattern.
2. **Q2 (minor) — is `Contact` distinct from `client_members`?** Recommend yes: `client_members`
   = platform users with a role; `Contact` = external people at the client (no login). Confirm.

## 11. Verification plan

```bash
npx prisma validate                  # if Q1→A2 migration; must be clean
npm run type-check                   # zero errors
npm run lint                         # --max-warnings 0
npm test -- app/api/clients          # new read-route suite: 401→403→400→200, real data
npm run e2e -- clients               # console renders a real client (if e2e wired)
```

Per-item live proof (master §15-style): `GET /api/clients` returns the caller's org clients (not
another org's — 403 on cross-org); `/dashboard/clients` renders ≥1 real client with its linked
primitives; no mock fixture anywhere in the path.

`[STATUS] gate: awaiting approval` — ratify Q1 (A2 recommended) before P-read. The migration
(if A2) and any prod introspection remain founder-gated; prod deploy stays the founder's call.
