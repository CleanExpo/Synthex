# AEO Phase A Audit — RestoreAssist (restoreassist.app)

**Generated:** 2026-04-28T20:31:32.326Z
**Tool:** `scripts/aeo-audit.mjs` (SYN-823 deliverable)
**Foundation:** Q3.2.3 A4 (schema-vs-content match) + Aid Rule + Phase 3.4 boundary + L7 carve-out (org-schema-only)

---

## https://restoreassist.app/

**HTTP 200** · 78ms · title: `RestoreAssist — One System. Fewer Gaps. More Confidence.` · meta-description: present (166 chars)

**JSON-LD:** 2 block(s) · 0 parse error(s) · types present: `Organization` · `SoftwareApplication`

**Missing expected types:** `WebSite`

### P0 findings (3)

- **Aid Rule** (`jsonld`)
  - "AI-powered restoration report software for Australian water damage and disaster recovery professionals. IICRC S500 compliant." matches pattern: AI-powered
  - _Foundation:_ Aid Rule binding (no AI-as-actor framing)

- **Aid Rule** (`jsonld`)
  - "Professional restoration report software with AI-powered assessment, IICRC S500 compliance, and comprehensive cost estimation for Australian restoration contractors." matches pattern: AI-powered
  - _Foundation:_ Aid Rule binding (no AI-as-actor framing)

- **Aid Rule** (`jsonld`)
  - "AI-powered report generation" matches pattern: AI-powered
  - _Foundation:_ Aid Rule binding (no AI-as-actor framing)

### P1 findings (2)

- **Schema-vs-content mismatch (Q3.2.3 A4)** (`JSON-LD block #0 (types: Organization)`)
  - 1/2 claim values found in visible page text. Mismatches: `.description` = "AI-powered restoration report software for Australian water damage and disaster recovery professionals. IICRC S500 compl"
  - _Foundation:_ Q3.2.3 A4

- **Schema-vs-content mismatch (Q3.2.3 A4)** (`JSON-LD block #1 (types: SoftwareApplication)`)
  - 1/3 claim values found in visible page text. Mismatches: `.offers.description` = "Free trial available" · `.description` = "Professional restoration report software with AI-powered assessment, IICRC S500 compliance, and comprehensive cost estim"
  - _Foundation:_ Q3.2.3 A4

### P2 findings (1)

- **Missing expected schema type**
  - Missing: WebSite
  - _Foundation:_ Brand-expected types per RestoreAssist foundation profile

### P3 findings (1)

- **Sister-brand mention (informational)**
  - Schema mentions sister brand(s): DR — review whether brand-distinctness per Q3.2.2 is at risk
  - _Foundation:_ Q3.2.2 brand-distinctness (informational)

---

## Headings sample (last URL)

**H1:** `Restore Assist`

**H2:** `Menu` · `How It Works` · `Inspection to Report in One Flow`
