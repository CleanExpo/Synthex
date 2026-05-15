# `brand-voice-enforce` — mechanical gate specification

**Date:** 2026-05-16
**Mandate:** `27e98e38-a6fd-4269-b223-db00f5e0e629` (Synthex Phase 4 · VG-AEO)
**Owner:** Senior Marketing Engineer
**Status:** SPEC — implementation lands in PR 2
**Parent:** SYN-822 (AEO epic) · gate referenced by SYN-827 / SYN-829 / SYN-830
**VG dependency:** VG-AEO-1 (NAP) + VG-AEO-2 (freshness) + VG-AEO-3 (per-brand SMS) + VG-AEO-4 (Bing parity)

---

## 1. Why this spec exists

The Empire Overview Board Memo (2026-05-10 Stage 4b) flipped VG-AEO-1..4 under `[CEO override]` so the 9-ticket AEO wave could execute. The override DID NOT bypass the `brand-voice-enforce` mechanical gates on SMS templates and earned-media drafts (registry header — Section 10 override conditions).

Before any SMS template (SYN-827) · outreach pitch (SYN-829) · post-job automation (SYN-830) lands, `brand-voice-enforce` must answer the question **"does this candidate string pass the brand's mechanical voice contract?"** with a deterministic `pass | fail` decision and an evidence trail.

Existing `lib/brand-voice/quality-scorer.ts` is LLM-based and subjective (Claude Haiku returns a 0–1 score). That is suitable for content review but unsuitable as a verification gate. The competing AEO trackers in the market (Profound, Otterly, Scrunch) ship read-only visibility — **the defensible wedge for Synthex VG-AEO-3 is mechanical per-brand enforcement**. Subjective scoring loses that wedge.

This spec defines a separate, deterministic gate that wraps the existing quality-scorer as a non-blocking advisory.

---

## 2. Input contract

```ts
import type { BrandSlug } from '@synthex/brand-config';

export interface BrandVoiceEnforceInput {
  /** Brand under test — resolves to BrandConfig via @synthex/brand-config */
  brand: BrandSlug;

  /** The candidate string to enforce against (SMS body, headline, paragraph) */
  candidate: string;

  /**
   * Surface the candidate is targeting.
   * Drives which rule set applies and which VG-AEO gates participate.
   */
  surface: 'sms' | 'outreach' | 'landing-page' | 'schema-faq' | 'gbp-post';

  /**
   * Optional source-of-truth job ID (REQUIRED for surface='sms' per Q3.2.4 H8).
   * Same ID flows into SmsSendAudit on send.
   */
  sourceOfTruthJobId?: string;

  /**
   * Optional NAP citation under test — only set when the candidate
   * embeds a business name / address / phone the gate must verify
   * against the brand's canonical entries (VG-AEO-1).
   */
  napCitation?: {
    businessName: string;
    address?: string;
    phone?: string;
  };

  /**
   * Optional mention reference — set when the candidate is responding to
   * a publisher mention or directory entry whose freshness must be checked
   * (VG-AEO-2).
   */
  mentionRef?: {
    mentionId: string;       // FK into mention_freshness when that table lands
    sourceUrl: string;
  };
}
```

The gate reads — and only reads — from:

1. **`BrandConfig.voice.tone[]`** — used for forbidden-word lookup (no tone-fitting judgement made mechanically)
2. **`BrandConfig.voice.forbiddenWords[]`** — exact-match (case-insensitive, word-boundary) reject list
3. **`BrandConfig.voice.requiredCadence?`** — informs cadence rule (max sentence length)
4. **`BrandConfig.pillars?.readingLevel?.hardFail`** — Flesch-Kincaid grade ceiling
5. **`BrandConfig.doNot[]`** — exact-substring reject list (case-insensitive)
6. **`FORBIDDEN_PRONOUNS`** — global first-person ban (already exported)
7. **`mention_freshness` table** (when it lands) — `last_seen_at` lookup
8. **`nap_citation` table** (when it lands) — canonical NAP per brand

Note: items 7 and 8 are scaffolded as nullable inputs in this spec because the upstream baselines (SYN-824 NAP audit + non-directory mention baseline) ship after this gate. Gate behaviour when input is `undefined`: skip that sub-rule, record reason, do NOT auto-fail (the upstream ticket is what populates the table).

---

## 3. Gate algorithm — deterministic rules only

Rules are evaluated **in order**. The gate short-circuits on first reject for performance, but the public output collects all reasons by re-evaluating non-short-circuit rules so the caller sees a complete failure surface.

| # | Rule | Triggers | Severity |
|---|------|----------|----------|
| R1 | **Forbidden-word match** — case-insensitive word-boundary match against `BrandConfig.voice.forbiddenWords` | any match | REJECT |
| R2 | **Forbidden-substring match** — case-insensitive substring match against `BrandConfig.doNot` | any match | REJECT |
| R3 | **First-person pronoun** — case-insensitive word-boundary match against `FORBIDDEN_PRONOUNS` (`we`, `our`, `i`, `us`, `my`) — exempt when surface = `gbp-post` (GBP posts speak in first person) | any match | REJECT |
| R4 | **Reading-level ceiling** — Flesch-Kincaid grade computed on `candidate`; reject if grade > `BrandConfig.pillars.readingLevel.hardFail` (skipped when brand has no `readingLevel` configured) | grade above hardFail | REJECT |
| R5 | **Cadence — max sentence length** — when `requiredCadence === 'short'`, reject if any sentence > 18 words; `'medium'` → 28 words; `'long'` → no limit | any sentence over limit | REJECT |
| R6 | **VG-AEO-1 NAP citation match** — when `input.napCitation` set, look up canonical NAP for brand in `nap_citation` table. Business name must match exactly (case-insensitive trim); phone must match by E.164 normalised string; address (when present) must match line 1 (case-insensitive trim). Missing canonical row → skip (record `evidence: 'nap_canonical_missing'`), not REJECT — VG-AEO-1 itself is `[CEO override]` until the audit lands | mismatch | REJECT |
| R7 | **VG-AEO-2 freshness** — when `input.mentionRef` set, look up `mention_freshness.last_seen_at` for the mention ID. Reject if `now() - last_seen_at > 24h`. Missing row → skip (record `evidence: 'mention_unknown'`), not REJECT | stale > 24h | REJECT |
| R8 | **Surface-specific length** — `surface === 'sms'` → reject if `candidate.length > 320` chars (2 GSM segments). `surface === 'gbp-post'` → reject if `candidate.length > 1500` chars (GBP post hard cap). Other surfaces have no length rule here | over surface limit | REJECT |
| R9 | **Job-ID requirement** — `surface === 'sms'` requires `input.sourceOfTruthJobId` (Q3.2.4 H8 binding). Missing → REJECT | missing for sms | REJECT |

**Explicitly out of scope (subjective — NOT in this gate):**

- Tone-fit ("does this *feel* authoritative") — handled by `quality-scorer.ts` as advisory only
- Brand-alignment narrative score
- "Engagement likelihood" or any predicted-behaviour metric
- LLM-as-judge for any rule above

The mechanical bar is: if a rule cannot be expressed as a pure function of the input + `BrandConfig` + two well-defined tables, **push it back to the spec — do not invent it**.

---

## 4. Output contract

```ts
export interface BrandVoiceEnforceResult {
  pass: boolean;
  /** One reason per triggered rule, in rule-number order. Empty when pass=true */
  reasons: string[];
  /**
   * Stable URLs / IDs the auditor can re-fetch to verify the decision.
   * E.g. canonical NAP row ID, mention_freshness row ID, BrandConfig SHA at evaluation time.
   */
  evidence_urls: string[];
  /** Echo back for audit-trail join */
  brand: BrandSlug;
  surface: BrandVoiceEnforceInput['surface'];
  /** ms taken end-to-end (excluding any LLM call — this gate is sync-fast) */
  durationMs: number;
}
```

`reasons` strings follow a stable format: `"<RULE_ID>: <human reason>"` — e.g. `"R1: forbidden word \"world-class\" matched"` — so tests can `expect(result.reasons).toContain(...)` without flakiness.

---

## 5. Implementation location

```
lib/aeo/
├── brand-voice-enforce.ts    # public function `enforceBrandVoice(input): Promise<BrandVoiceEnforceResult>`
├── rules.ts                   # one exported function per rule R1..R9 (pure where possible)
├── flesch-kincaid.ts          # zero-dep grade-level computation
├── tracking.ts                # persists every call into aeo_gate_runs
└── types.ts                   # input + output types (re-exported from lib/aeo/index.ts)
```

Hard rules for the implementation:

- **No `--no-verify`** — type-check + lint + tests all green before PR opens.
- **No new runtime deps** — Flesch-Kincaid is ~30 lines of arithmetic; no need for `text-readability` or similar.
- **Lazy-init Prisma** — match the SYN-953 lazy-init pattern across recent commits; do not eagerly construct PrismaClient at module import.
- **Tests use fixtures, not snapshots** — 10+ fixture cases under `__tests__/aeo/fixtures/` covering each rule's pass and fail paths plus 2 edge cases (empty candidate, unicode).
- **Brand isolation** — the gate must never read another brand's `BrandConfig` for fallback. Missing brand → throw (caller has a bug).

---

## 6. Test contract

`__tests__/aeo/brand-voice-enforce.spec.ts` MUST cover:

| # | Fixture name | Brand | Surface | Rule under test | Expectation |
|---|--------------|-------|---------|-----------------|-------------|
| T1 | `dr-sms-forbidden-word.json` | dr | sms | R1 | fail · reason starts `R1:` |
| T2 | `dr-sms-pronoun-leak.json` | dr | sms | R3 | fail · reason starts `R3:` |
| T3 | `dr-sms-clean-passes.json` | dr | sms | — | pass · reasons empty |
| T4 | `ra-outreach-reading-level-fail.json` | ra | outreach | R4 | fail · reason starts `R4:` |
| T5 | `ra-outreach-cadence-long-sentence.json` | ra | outreach | R5 | fail · reason starts `R5:` |
| T6 | `dr-sms-too-long.json` | dr | sms | R8 | fail · reason starts `R8:` |
| T7 | `dr-sms-missing-job-id.json` | dr | sms | R9 | fail · reason starts `R9:` |
| T8 | `dr-sms-nap-mismatch.json` | dr | sms | R6 | fail · reason starts `R6:` (mocked canonical NAP row) |
| T9 | `dr-outreach-stale-mention.json` | dr | outreach | R7 | fail · reason starts `R7:` (mocked freshness row 26h old) |
| T10 | `nrpg-gbp-post-pronoun-allowed.json` | nrpg | gbp-post | R3 exemption | pass — first person OK on GBP posts |
| E1 | `edge-empty-candidate.json` | dr | sms | — | fail · R8 (length 0 still triggers when sms surface hits R9 first; document behaviour) |
| E2 | `edge-unicode-cadence.json` | ra | outreach | R5 | pass · multi-byte word boundary correct |

All fixtures are JSON files committed alongside the test, NOT inline string literals — so a non-engineer can add a fixture by dropping a JSON file in.

---

## 7. Tracking — every gate run persists

```prisma
// =============================================================================
// SYN-822 Phase 4 / VG-AEO — brand-voice-enforce audit trail
// Migration: supabase/migrations/2026051600000X_aeo_gate_runs.sql
// =============================================================================

model AeoGateRun {
  id                          String    @id @default(uuid()) @db.Uuid
  brand                       String
  surface                     String    // 'sms' / 'outreach' / 'landing-page' / 'schema-faq' / 'gbp-post'
  pass                        Boolean
  reasons                     String[]  // empty array when pass=true
  evidenceUrls                String[]  @map("evidence_urls")
  candidateHash               String    @map("candidate_hash")    // sha256 of the candidate — never store body
  candidateLength             Int       @map("candidate_length")
  sourceOfTruthJobId          String?   @map("source_of_truth_job_id")
  durationMs                  Int       @map("duration_ms")
  ruleSetVersion              String    @default("2026-05-16") @map("rule_set_version")
  brandConfigSha              String?   @map("brand_config_sha")  // git SHA of brand-config at eval time
  createdAt                   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  @@index([brand, createdAt(sort: Desc)])
  @@index([surface, createdAt(sort: Desc)])
  @@index([pass, createdAt(sort: Desc)])
  @@index([sourceOfTruthJobId])
  @@map("aeo_gate_runs")
}
```

**PII discipline (per `lib/sms/` Q3.2.5 P10):**

- `candidateHash` only — never the candidate body. SMS body PII risk is real.
- Caller code MAY log the failure reasons short-form for debugging (no PII risk in reason strings — they refer only to brand-level rules and forbidden words).
- No recipient phone, no source-of-truth lookup keys other than the job ID itself.

**Migration ships with:**

- `ENABLE ROW LEVEL SECURITY` (matches existing 8-table AEO migration pattern)
- Two RLS policies: `aeo_gate_runs_admin_select` + `aeo_gate_runs_service_role_all`
- A comment on the table referencing this spec doc by path

---

## 8. Caller integration — order of operations

When `lib/sms/twilio-provider.ts` is enriched to call the gate (separate PR), the call site looks like:

```ts
const enforce = await enforceBrandVoice({
  brand: input.brand,
  candidate: input.body,
  surface: 'sms',
  sourceOfTruthJobId: input.sourceOfTruthJobId,
});

if (!enforce.pass) {
  await trackSmsBlocked(input, enforce.reasons);   // emits to aeo_gate_runs already; this is the SmsSendAudit side
  throw new BrandVoiceEnforceError(enforce.reasons);
}

// only now do we hand the body to Twilio
return provider.send(input);
```

The gate is upstream of the SMS provider — `lib/sms/` stays a dumb pipe (its hard-rule 5 is preserved).

---

## 9. Open questions deferred to PR 2 implementation

These are the explicit "I can't write a deterministic rule yet" items per CLAUDE.md "push that decision back to the spec":

1. **NAP canonical source-of-truth** — `nap_citation` table does NOT yet exist. SYN-824 (Phase A audit baseline) is the upstream that lands it. Until then, R6 is a no-op skip-with-evidence. **No invented schema in PR 2.**
2. **Mention freshness ingestion cadence** — `mention_freshness.last_seen_at` write path is SYN-824 (A5) deliverable. PR 2 reads the table if present, skips with evidence if not. **No invented poller in PR 2.**
3. **Phone E.164 normalisation** — PR 2 ships a basic `+\d{8,15}` regex + strip whitespace. If SYN-827 (SMS template authoring) finds the regex insufficient, raise a follow-up — do not gold-plate.
4. **Per-surface forbidden-word overrides** — out of scope for this gate. `BrandConfig.voice.forbiddenWords` is brand-wide. If we discover a surface needs its own list, that's a `BrandConfig` schema change, not a gate change.
5. **Reading level fallback when `pillars` missing** — R4 is skipped (recorded as `evidence: 'reading_level_unconfigured'`). It does NOT block the brand from using the gate. Brands without `pillars.readingLevel` are RestoreAssist-only at H-1 today; all others tolerate the skip.

---

## 10. PR sequencing

- **PR 1 (this doc):** spec ships; no code changes; reviewers gate on "does the rule set cover the surface area the AEO wave needs?"
- **PR 2:** `lib/aeo/brand-voice-enforce.ts` + tests + Prisma model + Supabase migration. Squash merge. Type-check, lint, tests all green; no `--no-verify`.
- **PRs 3-10:** SYN-822 / SYN-824 / SYN-825 / SYN-826 / SYN-827 / SYN-828 / SYN-829 / SYN-830 / SYN-831 — each PR title states its gate dependency. SMS-template PRs (SYN-827 / SYN-830) DO NOT ship before PR 2 is merged.

---

## 11. Reference-customer slot mapping (90-day mandate)

The Strategic Context note ("lock 3 reference customers within 90 days") maps onto this gate as follows:

| Slot | Profile | Why this gate matters to them |
|------|---------|-------------------------------|
| Slot 1 — High-volume B2C restorer | DR-equivalent independent (Brisbane / Sydney / Melbourne) | Per-brand SMS templates with mechanical enforcement is the wedge competitors lack. Slot-1 sells "you can't get blocked by Twilio for off-brand content" |
| Slot 2 — Multi-location franchise | A property-services franchise group (carpet / pest / plumbing) | Multi-brand voice rules from a single dashboard. The brand-isolation hard rule (Section 5) is the proof |
| Slot 3 — Insurance carrier / scheme | An insurance carrier running a contractor scheme | Audit trail (`aeo_gate_runs` + `verification_gate_audit`) is the carrier-compliance proof point. Slot-3 sells "every customer-facing string traceable to the gate that approved it" |

Slot identification is a commercial-decision recommendation, not a commitment.

---

**Source-of-record:** this doc · `.claude/memory/verification-gates.md` Section 10 · SYN-822 epic description · SYN-832 (foundation-keeper, Done).
