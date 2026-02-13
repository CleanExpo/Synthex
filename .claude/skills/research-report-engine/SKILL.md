---
name: research-report-engine
description: >-
  Generates original research reports with first-party data that become citation
  magnets for AI search engines. Uses Paper Banana for data visualizations and
  combines authority-curator's research template with GEO-optimized formatting
  for maximum AI citability. Includes SAS (Synthex Authority Score) methodology,
  Dataset schema, and "Cite This Research" blocks. Use when creating research
  reports, generating first-party data, building citation magnets, or producing
  industry benchmarks.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: generation-skill
  triggers:
    - research report
    - first-party data
    - original research
    - data study
    - survey analysis
    - citation magnet
    - industry benchmark
  requires:
    - skills/search-dominance/authority-curator.skill.md
    - .claude/skills/geo-engine
    - .claude/skills/paper-banana-visual
---

# Research Report Engine — First-Party Data Generation

## Purpose

Generate original research reports optimized as citation magnets for AI search
engines. Combines the authority-curator research template (Shocking Hook H1s,
Anti-AI Voice Protocols, SAS scoring) with GEO-optimized passage formatting
(134-167 word citable blocks) and Paper Banana data visualizations.

## When to Use

Activate this skill when:
- Creating survey-based research reports
- Generating industry benchmark reports with original data
- Building citation magnet content for AI search engines
- Producing Dataset schema for Google Dataset Search
- Creating reports with GEO-optimized passage formatting
- Applying SAS (Synthex Authority Score) methodology

## When NOT to Use This Skill

- When writing regular blog posts (use authority-curator directly)
- When scoring existing content (use geo-engine or eeat-scorer)
- When managing author profiles (use author-authority)
- When creating local case studies (use local-seo-generator)
- Instead use: `authority-curator` for regular content, `geo-engine` for scoring

## Instructions

1. **Receive research brief** — Accept topic, data sources, target audience,
   industry vertical
2. **Apply Shocking Hook H1** — From authority-curator:
   - Must contain specific number/statistic
   - Must imply actionable consequence
   - Must be verifiable (cite source in first paragraph)
   - Maximum 70 characters for SERP display
3. **Write Executive Summary** — 50-100 words:
   - Key finding in first sentence (answer-first for GEO)
   - Scope of research
   - Actionable takeaway
   - Format as 134-167 word citable passage block
4. **Document Methodology** — Include:
   - Data sources listed with trust levels
   - Sample size (if applicable)
   - Time period covered
   - Limitations acknowledged
5. **Present Key Findings** — Numbered list:
   - Lead with most surprising finding
   - Include exact figures with inline citations
   - Each finding as self-contained 134-167 word block
   - Apply Anti-AI Voice Protocols (no forbidden phrases)
6. **Generate visualizations** — Via paper-banana-visual:
   - At least one data table/chart per finding
   - Properly labelled axes with source attribution
   - Diagrams for complex relationships
7. **Calculate SAS Score** — Synthex Authority Score (0-10):
   - Data Recency (20%): Data from last 12 months
   - Source Quality (25%): Percentage from .gov/.edu sources
   - Sample Size (20%): Statistical significance
   - Verification (20%): Independent fact-checking
   - Actionability (15%): Clear next steps provided
8. **Generate schema markup** — JSON-LD:
   - Dataset schema for Google Dataset Search
   - Article schema with author
   - Table schema for data tables
   - SpeakableSpecification for key passages
9. **Create Cite This Research block** — Pre-formatted:
   - APA format
   - Harvard format
   - MLA format
   - Copy-to-clipboard button
10. **Run GEO check** — Via geo-engine, verify:
    - All passages meet 134-167 word target
    - Answer-first formatting in all sections
    - Question-based headings where appropriate
    - Citation density >= 1 per 200 words

## Input Specification

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| topic | string | yes | Research topic |
| dataSources | array | no | [{name, url, type}] |
| targetAudience | string | no | Who this report is for |
| industry | string | no | Industry vertical |
| authorId | number | no | Link to AuthorProfile |

## Output Specification

| Field | Type | Description |
|-------|------|-------------|
| report | object | Full report with all sections |
| sasScore | number | 0-10 Synthex Authority Score |
| schemaMarkup | object | Complete JSON-LD package |
| visuals | array | Generated visual asset URLs |
| geoScore | number | 0-100 GEO readiness score |
| citations | array | [{text, source, url, format}] |
| citeBlock | object | {apa, harvard, mla} formatted citations |

## Quality Gates (from authority-curator)

| Gate | Criteria | Blocker |
|------|----------|---------|
| G1: Accuracy | All facts verified | YES |
| G2: Voice | Zero AI-isms detected | YES |
| G3: Citations | 1 citation per 200 words min | YES |
| G4: Structure | All required sections present | YES |
| G5: GEO | Passages meet 134-167 word target | YES |
| G6: SAS | Score >= 7.0/10 | YES |

## Error Handling

| Error | Action |
|-------|--------|
| Insufficient data sources | Warn, proceed with available data, lower SAS score |
| SAS score < 7.0 | Block publication, provide improvement steps |
| Anti-AI voice violations | List violations, require manual correction |
| Visual generation failed | Continue with text tables, queue visual retry |
| GEO score < 50 | Provide specific passage reformatting instructions |
