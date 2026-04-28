# AEO Phase A Audit — CARSI (carsi.com.au)

**Generated:** 2026-04-28T20:31:33.960Z
**Tool:** `scripts/aeo-audit.mjs` (SYN-823 deliverable)
**Foundation:** Q3.2.3 A4 (schema-vs-content match) + Aid Rule + Phase 3.4 boundary + L7 carve-out (org-schema-only)

---

## https://carsi.com.au/

**HTTP 200** · 278ms · title: `CARSI | Restoration Training — IICRC CEC Platform` · meta-description: present (148 chars)

**JSON-LD:** 3 block(s) · 0 parse error(s) · types present: `EducationalOrganization` · `LocalBusiness` · `WebSite` · `FAQPage`

**Missing expected types:** `Organization`

### P1 findings (2)

- **Schema-vs-content mismatch (Q3.2.3 A4)** (`JSON-LD block #0 (types: EducationalOrganization+LocalBusiness)`)
  - 2/18 claim values found in visible page text. Mismatches: `.alternateName` = "Centre for Australian Restoration and Standards Information" · `.description` = "Australia's leading online training platform for disaster restoration professionals. IICRC CEC-approved courses in water" · `.areaServed[0].name` = "New South Wales" · `.areaServed[1].name` = "Victoria" · `.areaServed[2].name` = "Queensland" · `.areaServed[3].name` = "Western Australia" · `.areaServed[4].name` = "South Australia" · `.areaServed[5].name` = "Tasmania" · `.areaServed[6].name` = "Australian Capital Territory" · `.areaServed[7].name` = "Northern Territory" · `.hasOfferCatalog.name` = "IICRC CEC Training Programs" · `.hasOfferCatalog.itemListElement[0].itemOffered.name` = "Water Restoration Technician (WRT)" · `.hasOfferCatalog.itemListElement[1].itemOffered.name` = "Applied Structural Drying (ASD)" · `.hasOfferCatalog.itemListElement[2].itemOffered.name` = "Fire and Smoke Restoration Technician (FSRT)" · `.hasOfferCatalog.itemListElement[3].itemOffered.name` = "Carpet Cleaning Technician (CCT)" · `.hasOfferCatalog.itemListElement[4].itemOffered.name` = "Odour Control Technician (OCT)"
  - _Foundation:_ Q3.2.3 A4

- **Unverified category claim** (`jsonld`)
  - "Australia's leading online training platform for disaster restoration professionals. IICRC CEC-approved courses in water, fire, and carpet restoration delivered to students Australia-wide." — claim "Australia's leading" requires VG-state [verified-DD/MM/YYYY] or fallback to functional language
  - _Foundation:_ category-claim gating (pr-communications-lead NEVER list rule 1)

### P2 findings (1)

- **Missing expected schema type**
  - Missing: Organization
  - _Foundation:_ Brand-expected types per CARSI foundation profile

### P3 findings (1)

- **Sister-brand mention (informational)**
  - Schema mentions sister brand(s): DR, NRPG — review whether brand-distinctness per Q3.2.2 is at risk
  - _Foundation:_ Q3.2.2 brand-distinctness (informational)

---

## Headings sample (last URL)

**H1:** `Learn like the pros. On your schedule.`

**H2:** `Numbers that matter to busy professionals` · `IICRC pathways` · `IICRC discipline map &amp; pathways` · `Popular courses learners start with` · `Built for every sector you serve`
