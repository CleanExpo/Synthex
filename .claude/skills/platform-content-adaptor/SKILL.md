---
name: platform-content-adaptor
description: >-
  Adapts a single piece of content into correctly formatted versions for all social
  media platforms — LinkedIn, Instagram, Facebook, TikTok, X/Twitter, YouTube, Pinterest,
  and Google Business Profile. Adjusts length, tone, hashtags, emojis, and structure
  per platform. Use when the user says "adapt this for all platforms", "resize this post",
  "make a LinkedIn version", "turn this into a TikTok script", "platform versions", or
  pastes content and asks to distribute it across channels.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: workflow-skill
  triggers:
    - adapt for all platforms
    - resize content
    - platform versions
    - turn into tiktok
    - linkedin version
    - repurpose content
    - cross-post
    - distribute content
---

# Platform Content Adaptor

## Purpose

Takes one piece of content (post, article, video script, announcement) and produces
correctly formatted versions for every platform the user is active on. Uses the
Business DNA profile to maintain brand voice throughout all adaptations.

This maps directly to `lib/ai/content-repurposer.ts` — the Synthex content
repurposing engine — extended with platform-aware formatting rules.

## Workflow

```
1. Receive source content from user
2. Identify source type (post, article, video, announcement)
3. Load Business DNA for brand voice consistency
4. Adapt for each requested platform using rules below
5. Score each adaptation via content-scorer
6. Present all versions for review and one-click scheduling
```

## Platform Adaptation Rules

### LinkedIn

- **Length:** 150–300 words for thought leadership; 50–100 for quick updates
- **Structure:** Hook first line (no "I'm excited to announce") → context → insight → CTA
- **Formatting:** Line breaks every 2-3 sentences. Bullet points for lists.
- **Hashtags:** 3-5 professional hashtags at the end (not mid-text)
- **Tone:** Professional but personal. First-person narrative works well.
- **Avoid:** Excessive emoji, buzzwords ("synergy", "leveraging"), clickbait hooks

### Instagram

- **Length:** 100–150 words for caption; first line is critical (shows before "more")
- **Structure:** Hook (first 125 chars visible) → story → CTA → hashtags as comment or after 5 line breaks
- **Hashtags:** 10-20 relevant hashtags; mix broad (1M+), medium (100K-1M), niche (<100K)
- **Emoji:** Use contextually, not decoratively. 3-5 per post maximum.
- **Tone:** Conversational, visual, community-focused

### Facebook

- **Length:** 80–150 words for organic; shorter for ads
- **Structure:** Question or statement hook → value → CTA
- **Formatting:** Short paragraphs. Native video performs best.
- **Hashtags:** 1-3 only (Facebook penalises hashtag overuse)
- **Tone:** Community-friendly, approachable, slightly more casual than LinkedIn

### TikTok / Instagram Reels

- **Format:** Video script with hook, body, and CTA
- **Structure:**
  ```
  HOOK (0-3s): [attention-grabbing opening line — spoken to camera]
  SETUP (3-10s): [context or problem statement]
  VALUE (10-40s): [key content — tip, story, or transformation]
  CTA (40-60s): [follow / comment / visit link in bio]
  CAPTION: 50-100 words + 5-10 hashtags
  ```
- **Tone:** Energetic, fast-paced, casual, direct

### X / Twitter

Single tweet (280 chars):
```
[Hook — under 100 chars] + [value or proof] + [CTA or question]
#hashtag1 #hashtag2
```

Thread (5-7 tweets):
```
Tweet 1: Bold hook or controversial statement (ends with "Thread 🧵")
Tweet 2-6: One insight per tweet, numbered (2/)
Tweet 7: Summary + CTA + link
```

- **Tone:** Punchy, opinionated, conversational
- **Hashtags:** 1-2 per tweet maximum

### YouTube

- **Title:** 50-70 chars. Include primary keyword. Start with number or power word.
- **Description:**
  ```
  [2-3 sentence summary with keywords]

  CHAPTERS:
  00:00 - Introduction
  [timestamps if available]

  LINKS:
  [website, social profiles]

  TAGS: [comma-separated keywords]
  ```
- **Tone:** Informative, clear, searchable

### Pinterest

- **Description:** 100-200 words, keyword-rich
- **Title:** 40-100 chars, front-load keywords
- **Focus:** Inspirational, aspirational, search-optimised
- **Hashtags:** 2-5 in description

### Google Business Profile

- **Post length:** 300 words maximum, 100-150 optimal
- **Types:** What's New, Event, Offer, Product
- **CTA:** Always include a CTA button type (Call, Book, Learn more, Order online, Buy)
- **Keywords:** Include local + service keywords naturally
- **Tone:** Professional, trustworthy, local

## Adaptation via Synthex Repurposer

**File:** `lib/ai/content-repurposer.ts`

```typescript
import { repurposeContent } from '@/lib/ai/content-repurposer';

const adaptations = await repurposeContent({
  sourceContent: originalPost,
  targetPlatforms: ['linkedin', 'instagram', 'tiktok', 'twitter'],
  persona: brandPersona,  // brand voice from Business DNA
});
```

## Output Format

Present all adaptations in a scannable format:

```
ORIGINAL: [first 50 chars of source content...]

LINKEDIN (Score: 84)
[adapted content]

INSTAGRAM (Score: 78)
[adapted content + hashtags]

TIKTOK SCRIPT (Score: 81)
HOOK: [hook line]
BODY: [script]
CTA: [cta line]
CAPTION: [caption + hashtags]

→ Schedule all? Or select platforms to approve individually.
```

## Reference

- Repurposer: `lib/ai/content-repurposer.ts`
- Scorer: `lib/ai/content-scorer.ts`
- Platform rules: `lib/social/platform-rules.ts` (if exists) or apply rules above
- Social integrations: `.claude/skills/social-integrations/`
