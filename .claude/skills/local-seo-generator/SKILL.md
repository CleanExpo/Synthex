---
name: local-seo-generator
description: >-
  Generates hyper-local case studies with original visuals via Paper Banana,
  before/after galleries, verified credentials, and NAP-consistent business
  citations. Implements the Display for Experience pillar of GEO strategy.
  Use when creating location-specific content, validating NAP consistency,
  generating local schema markup, or building location landing pages.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: generation-skill
  triggers:
    - local SEO
    - case study
    - local visibility
    - NAP consistency
    - Google Business Profile
    - local content
    - location page
  requires:
    - skills/australian/geo-australian.skill.md
    - .claude/skills/paper-banana-visual
    - skills/search-dominance/authority-curator.skill.md
---

# Local SEO Generator — Hyper-Local Content Factory

## Purpose

Generate hyper-local case studies and location landing pages with original
visuals, NAP-consistent citations, and LocalBusiness schema markup. This
skill implements Pillar 2 (Display for Experience) of the GEO strategy.

## When to Use

Activate this skill when:
- Creating suburb-level case study content
- Building location landing pages with local signals
- Generating before/after visual galleries
- Validating NAP consistency across directories
- Creating LocalBusiness + Service schema markup
- Optimizing Google Business Profile content

## When NOT to Use This Skill

- When doing general SEO audits (use seo-audit)
- When analysing GEO citability of existing content (use geo-engine)
- When creating research reports (use research-report-engine)
- When managing author profiles (use author-authority)
- Instead use: `geo-engine` for scoring, `seo-audit` for audits

## Instructions

1. **Receive location brief** — Accept suburb, city, state, service type,
   and client business details
2. **Generate case study content** — Using authority-curator voice protocols:
   - Challenge section: Specific local problem with details
   - Solution section: What was done, methods, timeline
   - Results section: Measurable outcomes with numbers
   - Testimonial: Client quote (if available)
3. **Generate visuals** — Via paper-banana-visual skill:
   - Before/after comparison diagrams
   - Process flow diagrams
   - Results infographic with local data
4. **Build schema markup** — Generate JSON-LD:
   - LocalBusiness with NAP data
   - Service schema linking to case study
   - Review/Rating if testimonial available
   - GeoCoordinates for map integration
5. **Validate NAP consistency** — Check:
   - Business name matches across all directories
   - Address format consistent (no abbreviation mismatches)
   - Phone number format consistent (with area code)
6. **Apply Australian locale** — Via geo-australian skill:
   - Australian spelling
   - Local regulations and standards
   - AUD pricing
   - State-specific requirements
7. **Output complete package** — Case study content + visuals + schema + NAP report

## Input Specification

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| suburb | string | yes | Target suburb name |
| city | string | yes | City name |
| state | string | yes | State/territory |
| postcode | string | yes | Postcode |
| serviceType | string | yes | Type of service featured |
| businessDetails | object | no | {name, address, phone, website} |
| testimonial | string | no | Client testimonial quote |

## Output Specification

| Field | Type | Description |
|-------|------|-------------|
| caseStudy | object | {title, summary, challenge, solution, results} |
| visuals | array | [{type, url, altText, caption}] |
| schemaMarkup | object | Complete JSON-LD for the page |
| napReport | object | {consistent: boolean, issues: []} |
| slug | string | SEO-friendly URL slug |

## Error Handling

| Error | Action |
|-------|--------|
| Invalid suburb/postcode | Validate against AU postcode database |
| Missing business details | Generate schema without LocalBusiness, flag |
| Visual generation failed | Continue with text-only, queue visual retry |
| NAP inconsistency found | Report all mismatches with correction suggestions |
