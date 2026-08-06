# Gap Register — Agency Gap Audit

**Scoring model:** Closure 40% · Governance 25% · CEO load 20% · Reliability 15%  
**In-house closure score:** ~72/100 (post v12.0 phases 128–133, 2026-05-25)  
**Reliability sub-score (EXECUTION-PLAN Mar 2026):** 39/100 — do not conflate with agency closure.

| Gap ID  | Task   | Severity | Layer       | Description                                                                                 | Linear     | Dependency       |
| ------- | ------ | -------- | ----------- | ------------------------------------------------------------------------------------------- | ---------- | ---------------- |
| GAP-001 | AT-001 | P1       | Product     | DONE — orchestrate `skillContribution` + persist (#855/#857)                                | SYN-972    | —                |
| GAP-002 | AT-003 | P2       | Product     | DONE — brand-voice gate delegates to full R1–R9 `enforceBrandVoice` (#848/#865)             | SYN-972    | —                |
| GAP-003 | AT-026 | P2       | Product     | DONE — Advisor spawns contentCampaignWorkflow with brand-voice step                         | SYN-972    | —                |
| GAP-004 | AT-030 | P1       | Product     | DONE — seed:brands + brand-setup BrandDNA; CCW carve-out documented (ops seed human)        | SYN-973    | —                |
| GAP-005 | AT-031 | P0       | Product     | OAuth / publish loop [runbook](./at-031-live-publish-e2e.md) remains (live E2E human gate)  | SYN-974    | GAP-004          |
| GAP-006 | AT-005 | P2       | Product     | DONE — Tier-1 brand metrics from org-scoped Leads + gateCounts (#849/#867)                  | SYN-PM-107 | GAP-004          |
| GAP-007 | AT-029 | P2       | Product     | DONE — Tasks board supports AT-\* via `agencyTaskId` (Phase 128)                            | SYN-972    | —                |
| GAP-008 | AT-027 | P2       | Product     | DONE — Autonomous injects foundation + brand-voice gate on execute                          | SYN-972    | —                |
| GAP-009 | AT-028 | P2       | Product     | DONE — POST executions template=content-campaign + workflows UI builtin start               | SYN-972    | —                |
| GAP-010 | AT-004 | P2       | Product     | DONE — strategist gate stamps CEO queue clearance (#866)                                    | SYN-972    | —                |
| GAP-011 | AT-008 | P2       | Product     | DONE — `POST /api/marketing/tier3-portfolio-review` via senior-cmo (#869)                   | SYN-806    | —                |
| GAP-012 | AT-011 | P2       | Product     | DONE — `POST /api/marketing/cro-proposal` via cro-specialist (#860)                         | SYN-806    | —                |
| GAP-013 | AT-012 | P2       | Product     | DONE — `POST /api/marketing/email-sequence` via email-specialist (#856)                     | SYN-806    | —                |
| GAP-014 | AT-015 | P2       | Product     | DONE — GBP connect/sync honest empty-state (#874)                                           | SYN-974    | GAP-005          |
| GAP-015 | —      | P2       | Product     | Partial-routes inventory bannered (25/05 seed); full 100-page re-audit still open           | SYN-974    | Catalog priority |
| GAP-016 | —      | P2       | Drift       | DONE — SYSTEM_ARCHITECTURE_OVERVIEW corrected (no fully-autonomous / public-SaaS overclaim) | Docs       | —                |
| GAP-017 | —      | P3       | Commercial  | DONE — PRODUCT-ROADMAP-2026 marked archival; CONSTITUTION + 90-day roadmap are SSOT         | —          | PM sign-off      |
| GAP-018 | AT-032 | P2       | Product     | DONE — video queue 202 + UI poll (#851/#870)                                                | SYN-974    | —                |
| GAP-019 | —      | P1       | Reliability | Security/GDPR/stubs from EXECUTION-PLAN                                                     | Track 3    | —                |
| GAP-020 | —      | P0       | Ops         | Hooks blocked agent Write/Shell (fixed 2026-05-25)                                          | —          | Done             |

## P0 definition (signed in audit)

Blocks **weekly marketing cadence** for Unite portfolio without opening Claude Code for every step.
