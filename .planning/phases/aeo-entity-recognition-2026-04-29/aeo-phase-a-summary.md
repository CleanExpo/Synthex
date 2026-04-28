# AEO Phase A Audit — Cross-Portfolio Summary

**Generated:** 2026-04-28T20:31:34.811Z
**Tool:** `scripts/aeo-audit.mjs` (SYN-823 deliverable)
**Brands audited:** DR · RestoreAssist · CARSI · CCW
**Brands NOT audited:** NRPG (URL not yet confirmed by CEO)

## Headline

| Severity | Count | What it means                                                                                |
| -------- | ----- | -------------------------------------------------------------------------------------------- |
| **P0**   | 3     | Aid Rule violation OR Phase 3.4 cross-boundary breach — fix before any earned-media outreach |
| **P1**   | 6     | Schema-vs-content mismatch · parse errors · unverified category claims                       |
| **P2**   | 4     | Missing expected schema types — opportunity loss but no policy violation                     |
| **P3**   | 3     | Sister-brand mentions — informational, review if brand-distinctness at risk                  |

## Per-brand snapshot

| Brand         | URLs | JSON-LD blocks | Aid Rule | Phase 3.4 | Category claims | Schema mismatches |
| ------------- | ---- | -------------- | -------- | --------- | --------------- | ----------------- |
| DR            | 1    | 3              | ✅       | ✅        | ✅              | 🟡 2              |
| RestoreAssist | 1    | 2              | 🔴 3     | ✅        | ✅              | 🟡 2              |
| CARSI         | 1    | 3              | ✅       | ✅        | 🟡 1            | 🟡 1              |
| CCW           | 1    | 0              | ✅       | ✅        | ✅              | ✅                |

## What this audit cannot see (deferred to follow-up tickets)

- GBP attribute completeness — needs GBP API auth (Phill-side action SYN-823 A1+A2)
- GSC query gap analysis — needs Search Console OAuth (Phill-side SYN-823 A3)
- Whitespark/BrightLocal NAP — needs paid subscription (Phill decision #2 SYN-822)
- Server-rendered vs client-rendered schema — this tool fetches static HTML; client-injected schema not seen
- Subpage coverage — currently audits homepage only per brand; expand URL list when Phase B audit specifics are confirmed

## Next actions

1. Triage every P0 (Aid Rule + Phase 3.4) immediately — these are non-negotiable foundation rules
2. For each P1 schema-vs-content mismatch: either fix the schema OR add visible page content to match (Q3.2.3 A4 binding)
3. For each P1 category claim: route through pr-communications-lead claim-audit, fall back to functional language unless VG-state is verified
4. For each P2 missing schema type: route to seo-schema for generation
5. Re-run `node scripts/aeo-audit.mjs` after each fix to verify the cluster cleared
