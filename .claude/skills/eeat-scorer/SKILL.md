---
name: eeat-scorer
description: >-
  Automated E-E-A-T compliance scoring per the December 2025 update (now applies
  to ALL competitive queries, not just YMYL). Weights: Experience 20%, Expertise
  25%, Authoritativeness 25%, Trustworthiness 30%. Checks author attribution,
  first-hand experience signals, credentials, citation density, and trust
  indicators. Use when scoring content quality, auditing author profiles, or
  checking AI content detection patterns.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: analysis-skill
  triggers:
    - E-E-A-T score
    - experience signals
    - expertise check
    - trust signals
    - author authority
    - content quality score
    - YMYL check
  requires:
    - skills/search-dominance/authority-curator.skill.md
    - tools/claude-seo/seo/references/eeat-framework.md
---

# E-E-A-T Scorer — Content Quality Compliance Engine

## Purpose

Score any content against Google's E-E-A-T framework (updated December 2025).
Detects AI-generated content patterns, validates author profiles, and checks
citation density. Integrates the Anti-AI Voice Protocols from authority-curator.

## When to Use

Activate this skill when:
- Scoring content on 4-dimension E-E-A-T framework
- Checking author profile completeness for expertise signals
- Detecting AI-generated content patterns (forbidden phrases)
- Validating citation density (1 per 200 words minimum)
- Assessing first-hand experience signals
- Running pre-publish quality gates

## When NOT to Use This Skill

- When doing technical SEO audits (use seo-audit)
- When optimizing for AI citability specifically (use geo-engine)
- When creating research reports (use research-report-engine)
- When managing author profiles (use author-authority)
- Instead use: `geo-engine` for AI citability, `seo-audit` for technical checks

## Instructions

1. **Receive content + metadata** — Accept text, author info, URL
2. **Score Experience (20%)** — Check for:
   - First-person narrative signals ("I tested", "In my experience")
   - Original photos/screenshots (not stock)
   - Specific case studies with verifiable details
   - Process documentation showing actual work
   - Before/after results with data
3. **Score Expertise (25%)** — Check for:
   - Author credentials relevant to topic
   - Technical accuracy and depth
   - Claims supported by evidence
   - Specialized vocabulary used correctly
   - Up-to-date with current developments
   - Byline with credentials visible
4. **Score Authoritativeness (25%)** — Check for:
   - Site recognition as authority in niche
   - Author external citations and publications
   - Content cited by authoritative sources
   - Industry awards and certifications
   - Consistent publication history
5. **Score Trustworthiness (30%)** — Check for:
   - Clear contact information
   - Privacy policy and terms
   - HTTPS with valid certificate
   - Transparency about content creation
   - Customer reviews and testimonials
   - Corrections and update history
6. **Run Anti-AI Voice Check** — Scan for forbidden phrases from authority-curator:
   - Opening cliches ("In today's digital landscape...")
   - Hedging language ("It's important to note...")
   - Filler transitions ("Let's dive into...")
   - AI pomposity ("Delve into...", "Leverage the power of...")
   - False intimacy ("You might be wondering...")
7. **Check citation density** — Verify 1 citation per 200 words minimum
8. **Calculate overall** — Weighted: E(20%) + E(25%) + A(25%) + T(30%)
9. **Generate improvement roadmap** — Tier-based recommendations

## Input Specification

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| content | string | yes | Content text to score |
| authorInfo | object | no | {name, credentials, socialLinks} |
| url | string | no | URL for trust signal checking |
| contentType | string | no | 'article', 'product', 'service', 'ymyl' |

## Output Specification

| Field | Type | Description |
|-------|------|-------------|
| overallScore | number | 0-100 weighted E-E-A-T score |
| experienceScore | number | 0-100 first-hand experience |
| expertiseScore | number | 0-100 formal qualifications |
| authorityScore | number | 0-100 external recognition |
| trustScore | number | 0-100 reliability/transparency |
| aiDetectionFlags | array | Forbidden phrases found |
| citationDensity | number | Citations per 200 words |
| recommendations | array | [{dimension, action, priority}] |

## Score Tiers (from eeat-framework.md)

| Score | Description | Action |
|-------|-------------|--------|
| 90-100 | Exceptional E-E-A-T | Maintenance mode |
| 70-89 | Strong E-E-A-T | Minor improvements |
| 50-69 | Moderate E-E-A-T | Significant gaps |
| 30-49 | Weak E-E-A-T | Major overhaul needed |
| 0-29 | Very low E-E-A-T | Rebuild from scratch |

## Error Handling

| Error | Action |
|-------|--------|
| No author info provided | Score expertise/authority as 0, recommend adding |
| Content too short (<100 words) | Warn insufficient for meaningful scoring |
| URL unreachable | Score trust signals from content only |
| YMYL content detected | Apply stricter thresholds, flag for review |
