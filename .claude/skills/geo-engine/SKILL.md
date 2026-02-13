---
name: geo-engine
description: >-
  Core GEO scoring engine that analyzes content for AI search engine citability.
  Implements passage-level citability scoring (134-167 word blocks), structural
  readability analysis, multi-modal content detection, and platform-specific
  optimization for Google AI Overviews, ChatGPT, Perplexity, and Bing Copilot.
  Use when scoring content for AI visibility, optimizing passages, or analyzing
  GEO readiness.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: analysis-skill
  triggers:
    - GEO score
    - AI citability
    - passage optimization
    - machine synthesis
    - GEO analysis
    - AI search optimization
    - citability check
  requires:
    - tools/claude-seo/skills/seo-geo (reference data)
---

# GEO Engine — Generative Engine Optimization Scorer

## Purpose

Analyze any content for AI search engine citability and provide actionable
scoring across 5 dimensions. This is the core scoring engine that powers
SYNTHEX's GEO dashboard and integrates with the seo-geo reference skill.

## When to Use

Activate this skill when:
- Scoring content for AI Overview citation potential
- Analyzing passage-level citability (optimal 134-167 word blocks)
- Checking answer-first formatting compliance
- Validating structured data for AI discoverability
- Generating platform-specific GEO recommendations
- Running pre-publish GEO readiness checks

## When NOT to Use This Skill

- When doing general SEO audits without GEO focus (use seo-audit)
- When optimizing for traditional search only (use seo-page)
- When building content strategy (use search-dominance)
- When checking E-E-A-T signals specifically (use eeat-scorer)
- Instead use: `seo-audit` for full audits, `eeat-scorer` for E-E-A-T

## Instructions

1. **Receive content** — Accept raw text, URL, or content ID for analysis
2. **Extract structure** — Parse heading hierarchy (H1-H6), lists, tables, media
3. **Score citability** — Identify 134-167 word self-contained passage blocks,
   score each for quotability (specific facts, clear definitions, source attribution)
4. **Score structure** — Check H1>H2>H3 hierarchy, question-based headings,
   paragraph length (2-4 sentences), table/list usage
5. **Score multi-modal** — Detect images, videos, infographics, interactive elements,
   calculate multi-modal content ratio (156% higher selection rate with media)
6. **Score authority** — Check author byline, publication dates, citation density,
   entity presence signals, expert quotes
7. **Score technical** — Check SSR vs CSR, AI crawler access, llms.txt presence,
   schema markup completeness
8. **Calculate overall** — Weighted formula: citability(25%) + structure(20%) +
   multiModal(15%) + authority(20%) + technical(20%)
9. **Generate per-platform scores** — Adjust weights for Google AIO (traditional SEO + passages),
   ChatGPT (entity presence + Wikipedia), Perplexity (Reddit + community), Bing Copilot (Bing SEO)
10. **Output recommendations** — Prioritized by impact and effort

## Input Specification

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| content | string | yes | Raw text content to analyze |
| url | string | no | URL for technical checks |
| platform | string | no | Target platform: 'all', 'google_aio', 'chatgpt', 'perplexity' |

## Output Specification

| Field | Type | Description |
|-------|------|-------------|
| overallScore | number | 0-100 composite GEO score |
| citabilityScore | number | 0-100 passage citability |
| structureScore | number | 0-100 structural readability |
| multiModalScore | number | 0-100 multi-modal content |
| authorityScore | number | 0-100 authority signals |
| technicalScore | number | 0-100 technical accessibility |
| citablePassages | array | [{text, wordCount, score, startIndex}] |
| platformScores | object | {googleAIO, chatGPT, perplexity, bingCopilot} |
| recommendations | array | [{priority, action, impact, effort}] |

## Scoring Thresholds

| Score | Rating | Action |
|-------|--------|--------|
| 90-100 | Excellent | Maintain and monitor |
| 70-89 | Good | Minor optimizations |
| 50-69 | Moderate | Significant improvements needed |
| 30-49 | Weak | Major restructuring required |
| 0-29 | Critical | Content not AI-ready |

## Error Handling

| Error | Action |
|-------|--------|
| Empty content | Return error with minimum content requirements |
| URL unreachable | Score content-only, flag technical as incomplete |
| Missing headings | Score structure as 0, recommend adding hierarchy |
| No media detected | Score multi-modal as 0, recommend adding visuals |

## Key References

- Optimal passage length: 134-167 words (seo-geo skill data)
- 92% of AI Overview citations from top-10 pages
- 47% from below position 5 (different selection logic)
- Brand mentions correlate 3x more with AI visibility than backlinks
- Only 11% of domains cited by both ChatGPT and Google AIO for same query
