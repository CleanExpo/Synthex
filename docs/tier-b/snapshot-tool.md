# B4 — Snapshot Tool Engineering Build

> **Status:** Scoping only (SYN-812). Implementation phased over Days 0-90
> (per Q3.3.4); each phase is its own engineering milestone.

## Scope

Three-phase build of a privacy-first compliance assessment tool. Each phase
is a discrete deliverable; later phases gate on earlier phases.

## Phases

### Phase 1 — Days 0-14: Static PDF Compliance Checklist

Low-effort interim asset. Single PDF, manually maintained, hosted on
synthex.social. Linked from outbound emails (T1, T3, T7) and from the
public-facing landing pages. No backend.

**Deliverable:** one PDF (≤2MB) at `/static/compliance-checklist.pdf`,
canonical URL `https://synthex.social/compliance-checklist`.

### Phase 2 — Days 15-60: Interactive Snapshot Tool

Server-rendered web app, opt-in only, owner-deletable per P16.

Privacy stack (non-negotiable):

- **Opt-in only** — no implicit data collection; user explicitly clicks
  "Run my snapshot" before any field is captured
- **Server-side processing** — assessment logic runs on Synthex servers;
  no third-party trackers (no GA, no Meta Pixel, no Hotjar)
- **Owner-deletable per P16** — single button "Delete my snapshot data"
  that hard-deletes the row + cascades through any cached analytics
- **No marketing reuse without explicit per-firm consent (P6)** — even
  if the user opted in to the snapshot, that consent does NOT extend to
  newsletter / sequence enrollment
- **De-identified retention** — snapshot inputs (anonymised) may be
  retained for product improvement only, with the identifying fields
  stripped at write time

### Phase 3 — Days 60-90: Snapshot + Mailchimp + Checkout

Wire the Snapshot tool into B3 (Mailchimp audience) for users who
opt-in to the marketing layer separately, plus a firm-tier checkout flow
for paid Snapshot reports.

Tier structure:

- **Free** — basic compliance checklist (Phase 1 PDF or Phase 2 lite)
- **Firm tier** — full Snapshot with industry benchmarks + remediation
  recommendations + downloadable PDF report

## Foundation references

- Q3.3.4 — Snapshot tool engineering specification
- P6 — never reuse owner-deletable data for marketing without explicit
  per-firm consent
- P16 — Right-to-Be-Forgotten with de-identified retention
- VG-04 + VG-05 — IICRC S500 + S520 licensed source needed for the
  Snapshot's recommendation engine to cite authoritatively

## Schema

Phase 2 adds:

```
snapshot_runs                     -- one row per opt-in run
  id              text pk
  identity_id     text fk → identity_records.id (nullable; anonymous runs ok)
  inputs          jsonb           -- assessment answers (PII-stripped at write)
  computed_score  numeric
  remediation     jsonb           -- recommendation list
  consent_state   jsonb           -- { delete_requested_at, marketing_opt_in }
  created_at      timestamptz
```

Phase 3 adds:

```
snapshot_purchases                -- one row per paid Snapshot report
  id              text pk
  snapshot_run_id text fk → snapshot_runs.id
  stripe_session  text            -- Checkout Session ID
  paid_at         timestamptz
  receipt_url     text
```

## Smoke test plan

### Phase 1

1. PDF accessible at `/compliance-checklist` returns 200, ≤2MB, valid PDF.
2. Linked from at least one outbound email template + at least one
   public landing page.

### Phase 2

1. User opts in to snapshot → `snapshot_runs` row created with
   `identity_id = null` (anonymous) by default.
2. User clicks "Delete my snapshot" → row hard-deleted; same UI
   afterwards confirms "no record found".
3. No outbound network calls to non-Synthex domains during the
   snapshot session (verify in browser network tab).
4. Snapshot inputs in `snapshot_runs.inputs` have email, phone, and
   firm name fields stripped (verify with a test row).
5. Marketing opt-in checkbox is unchecked by default; checking it
   writes `consent_state.marketing_opt_in = true` AND triggers a B1
   identity-resolution upsert.

### Phase 3

1. User in firm tier completes checkout → `snapshot_purchases` row
   created; `stripe_session` populated; receipt URL accessible.
2. CARSI Cat 1 vs Cat 3 conversion arc — Snapshot result feeds into
   the Remotion video brief generation (verify by inspecting brief
   payload contains snapshot score).

## CEO action items (must clear before engineering starts)

- [ ] VG-04 — IICRC S500 licensed source acquired (recommendation
      engine cites this)
- [ ] VG-05 — IICRC S520 licensed source acquired
- [ ] Phase 1 PDF content drafted + signed off (compliance lawyer review
      recommended)
- [ ] Stripe firm-tier price tier defined (currently no price exists)
- [ ] Privacy policy updated to disclose Snapshot data retention rules
      (de-identified retention for product improvement)

## Out of scope

- Real-time competitor benchmarking — that's SYN-770 / SYN-774, separate
- Mobile app integration — RestoreAssist app handles its own
  compliance flows
- Multi-language Snapshot — English-only initially
