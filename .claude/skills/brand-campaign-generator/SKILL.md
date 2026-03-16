---
name: brand-campaign-generator
description: >-
  Generates a complete multi-platform social media campaign from a Business DNA profile
  or brand brief. Produces on-brand content variations for LinkedIn, Instagram, Facebook,
  TikTok, X, and YouTube — then schedules via Synthex. Use when the user says "create a
  campaign", "generate posts for my campaign", "write social content for [product/offer]",
  or "launch a campaign". Requires Business DNA (run business-dna skill first if not set).
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: workflow-skill
  triggers:
    - create campaign
    - generate campaign
    - social media campaign
    - write posts
    - launch campaign
    - content for my product
    - campaign content
---

# Brand Campaign Generator

## Purpose

Takes a Business DNA profile + a campaign goal and produces a complete set of
on-brand content variations for every active platform. Outputs to the Synthex
content pipeline for immediate scheduling, scoring, and publishing.

This is what Google Labs Pomelli does for visuals — but for text content with
Synthex's scheduling, BYOK AI, and analytics infrastructure behind it.

## Workflow

```
1. Load Business DNA (from brand-dna skill or ask user to describe brand)
2. Define campaign goal (product, offer, event, or theme)
3. Generate content matrix across all active platforms
4. Score each piece via content-scorer (zero AI calls)
5. Display campaign for review
6. Schedule approved content via Synthex calendar
```

## Campaign Input Collection

Ask the user for:

```
Campaign Brief:
- GOAL: What are you promoting? (product, sale, event, announcement)
- DURATION: How many days? (e.g. 7, 14, 30)
- CALL TO ACTION: What should people do? (book, buy, visit, DM)
- TONE OVERRIDE: Any tone shift for this campaign? (urgent, celebratory, etc.)
- PLATFORMS: Which platforms? (or use all from Business DNA)
```

## Content Matrix Structure

For each platform, generate:

| Platform | Format | Length | Variations |
|----------|--------|--------|------------|
| LinkedIn | article-style post | 150-300 words | 3 |
| Instagram | caption + hashtags | 100-150 words + 15 hashtags | 3 |
| Facebook | conversational post | 80-150 words | 3 |
| TikTok | script/caption | 50-100 words | 3 |
| X (Twitter) | thread or single | 280 chars / 5-tweet thread | 3 |
| YouTube | description + title | 150-200 words | 2 |

## Content Generation via Synthex Pipeline

**API endpoint:** `POST /api/ai/generate-content`

```typescript
const request = {
  type: 'post',
  platform: 'linkedin',        // iterate per platform
  tone: dna.toneOfVoice[0],   // from Business DNA
  personaId: brandPersonaId,   // if persona exists for this brand
  keywords: dna.vocabulary,
  targetAudience: dna.targetAudience,
  length: 'medium',
  includeHashtags: true,
  includeCTA: true,
};
```

**BYOK:** If user has a BYOK key, it is automatically injected via
`lib/ai/api-credential-injector.ts`. No AI cost to Synthex.

## Content Scoring

After generation, score each piece via `lib/ai/content-scorer.ts`.
Surface scores to user in the review panel:

```
[LINKEDIN POST 1]
Score: 87/100  | Engagement: 90 | Platform Fit: 95 | Readability: 82
[content here]

[INSTAGRAM CAPTION 1]
Score: 79/100  | Engagement: 85 | Platform Fit: 88 | Readability: 72
[content here + hashtags]
```

## Campaign Review Format

Present as a structured campaign block:

```
──────────────────────────────────────────
 CAMPAIGN: [Campaign Name]
 GOAL: [Goal]  |  DURATION: [X days]  |  POSTS: [total count]
──────────────────────────────────────────

LINKEDIN (3 posts)
  Post 1 — Score 87 ✓ [preview first 50 words...]
  Post 2 — Score 81 ✓
  Post 3 — Score 74 ⚠ [below 80 — consider revising]

INSTAGRAM (3 posts)
  ...

→ Approve all and schedule?
→ Or select specific posts to edit/replace.
```

## Scheduling

On approval, create scheduled posts via `POST /api/schedule`:

```typescript
// Spread posts across campaign duration using AI-suggested timing
// lib/ai/content-repurposer.ts handles platform-specific timing rules
```

See `social-integrations` skill for platform OAuth requirements.

## Reference

- Content generation: `lib/ai/content-generator.ts`
- Scoring: `lib/ai/content-scorer.ts`
- Repurposing: `lib/ai/content-repurposer.ts`
- BYOK injection: `lib/ai/api-credential-injector.ts`
- Scheduling API: `app/api/schedule/`
