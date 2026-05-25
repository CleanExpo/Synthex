# Gap Register — Agency Gap Audit

**Scoring model:** Closure 40% · Governance 25% · CEO load 20% · Reliability 15%  
**In-house closure score:** ~72/100 (post v12.0 phases 128–133, 2026-05-25)  
**Reliability sub-score (EXECUTION-PLAN Mar 2026):** 39/100 — do not conflate with agency closure.

| Gap ID  | Task   | Severity | Layer       | Description                                                                                 | Linear     | Dependency       |
| ------- | ------ | -------- | ----------- | ------------------------------------------------------------------------------------------- | ---------- | ---------------- |
| GAP-001 | AT-001 | P1       | Product     | H-1 partial — foundation context + workflow gates; full senior-strategist chain still IDE   | SYN-972    | —                |
| GAP-002 | AT-003 | P2       | Product     | brand-voice gate in contentCampaignWorkflow (mechanical); not full skill                    | SYN-972    | —                |
| GAP-003 | AT-026 | P2       | Product     | Advisor spawns contentCampaignWorkflow with brand-voice step (SYN-972)                      | SYN-972    | —                |
| GAP-004 | AT-030 | P1       | Product     | `seed:brands` script ready — run against DB to materialise tenants                          | SYN-973    | —                |
| GAP-005 | AT-031 | P0       | Product     | OAuth / publish loop not human-gated closed                                                 | SYN-974    | GAP-004          |
| GAP-006 | AT-005 | P2       | Product     | Tier-1 in product (`/api/agency/tier1-report` + cron); metrics hypothesised until GA4 wired | SYN-PM-107 | GAP-004          |
| GAP-007 | AT-029 | P2       | Product     | Tasks board supports AT-\* via `agencyTaskId` (Phase 128)                                   | SYN-972    | —                |
| GAP-008 | AT-027 | P2       | Product     | Autonomous injects foundation on execute (Phase 130)                                        | SYN-972    | —                |
| GAP-009 | AT-028 | P2       | Product     | contentCampaignWorkflow + brand-voice validation step                                       | SYN-972    | —                |
| GAP-010 | AT-004 | P2       | Product     | CEO queue API + brand-voice strip (workflows awaiting approval)                             | SYN-972    | —                |
| GAP-011 | AT-008 | P2       | Policy      | senior-cmo not in SYN-806 v0.1                                                              | SYN-806    | —                |
| GAP-012 | AT-011 | P2       | Policy      | cro-specialist not shipped                                                                  | SYN-806    | —                |
| GAP-013 | AT-012 | P2       | Policy      | email-specialist not shipped                                                                | SYN-806    | —                |
| GAP-014 | AT-015 | P2       | Product     | GBP/google-business partial + compliance                                                    | SYN-974    | GAP-005          |
| GAP-015 | —      | P2       | Product     | 100 dashboard routes partial (breadth)                                                      | SYN-974    | Catalog priority |
| GAP-016 | —      | P2       | Drift       | SYSTEM_ARCHITECTURE_OVERVIEW overstates orchestration                                       | Docs       | —                |
| GAP-017 | —      | P3       | Commercial  | PRODUCT-ROADMAP Stripe/onboarding vs MEMORY internal SaaS                                   | —          | PM sign-off      |
| GAP-018 | AT-032 | P2       | Product     | Video pipeline E2E unverified                                                               | SYN-974    | —                |
| GAP-019 | —      | P1       | Reliability | Security/GDPR/stubs from EXECUTION-PLAN                                                     | Track 3    | —                |
| GAP-020 | —      | P0       | Ops         | Hooks blocked agent Write/Shell (fixed 2026-05-25)                                          | —          | Done             |

## P0 definition (signed in audit)

Blocks **weekly marketing cadence** for Unite portfolio without opening Claude Code for every step.
