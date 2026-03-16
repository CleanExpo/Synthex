---
name: campaign-planner
description: >-
  Builds a structured 30, 60, or 90-day social media content calendar from a Business
  DNA profile and campaign goal. Produces weekly themes, content hooks, post types,
  posting cadence, and publishing schedule per platform. Use when the user says "plan
  my content", "content calendar", "monthly plan", "what should I post this month",
  "30-day plan", "quarterly campaign", or asks for a posting schedule for a product
  launch, seasonal push, or ongoing brand presence.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: workflow-skill
  triggers:
    - content calendar
    - content plan
    - 30 day plan
    - 60 day plan
    - 90 day plan
    - monthly content
    - quarterly campaign
    - posting schedule
    - what should I post
    - campaign planner
---

# Campaign Planner

## Purpose

Strategic content calendar builder. Takes a brand's Business DNA, a campaign goal,
and a timeframe — returns a structured posting schedule with weekly themes, content
hooks, post types, and AI-suggested posting times. Feeds directly into Synthex's
scheduling system for batch content creation and auto-publishing.

## Workflow

```
1. Collect campaign parameters (see input collection below)
2. Load Business DNA for brand context
3. Generate calendar structure (weeks → themes → post slots)
4. Assign content types and hooks to each slot
5. Suggest optimal posting times per platform
6. Output as structured calendar + offer to generate content for each slot
```

## Campaign Input Collection

Collect from user before planning:

```
CAMPAIGN PARAMETERS
  Goal:       [product launch / brand awareness / lead generation / seasonal / retention]
  Duration:   [30 / 60 / 90 days] — start date: [DD/MM/YYYY]
  Platforms:  [which platforms, or use all from Business DNA]
  Frequency:  [posts per week per platform — recommend 3-5 for most SMBs]
  Key dates:  [any launches, events, or deadlines within the period]
  Budget:     [organic only / includes paid ads]
  CTA:        [primary action — book / buy / DM / visit]
```

## Calendar Structure

### Phase Framework (30-day example)

| Week | Phase | Theme Focus | Content Mix |
|------|-------|-------------|-------------|
| Week 1 | Awareness | Brand story + problem statement | 60% educational, 40% brand |
| Week 2 | Interest | Solution + benefits | 50% value, 30% social proof, 20% CTA |
| Week 3 | Desire | Outcomes + transformation | 40% social proof, 40% CTA, 20% educational |
| Week 4 | Action | Urgency + conversion | 60% CTA, 30% social proof, 10% brand |

**For 60-day plans:** repeat the cycle with a different campaign angle in weeks 5-8.
**For 90-day plans:** add weeks 9-12 as retention/community phase.

### Content Type Mix (per week)

Healthy content mix across all SMB accounts:

| Type | % of Posts | Purpose |
|------|-----------|---------|
| Educational (tips, how-to) | 30% | Builds authority and saves/shares |
| Brand/story | 20% | Builds trust and connection |
| Social proof (reviews, results, case studies) | 20% | Converts consideration to intent |
| Promotional (offer, CTA) | 20% | Drives direct revenue |
| Community (questions, polls, UGC) | 10% | Builds engagement and algorithm reach |

### Platform Cadence (recommended for SMBs)

| Platform | Posts/Week | Best Days | Best Times (AEST) |
|----------|-----------|-----------|-------------------|
| LinkedIn | 3-4 | Tue, Wed, Thu | 7-9am, 12-1pm |
| Instagram | 4-5 | Mon, Wed, Fri, Sat | 7-9am, 6-8pm |
| Facebook | 3-4 | Wed, Thu, Fri | 9-11am, 1-3pm |
| TikTok | 5-7 | Daily | 7-9am, 7-10pm |
| X/Twitter | 5-7 | Weekdays | 8-10am, 12-1pm, 5-6pm |
| YouTube | 1-2 | Wed, Sat | 12-3pm, 6-9pm |

*Times are suggestive — override with actual engagement data from Synthex analytics
once available for the user's specific audience.*

## Calendar Output Format

Deliver as a structured week-by-week plan:

```
──────────────────────────────────────────
 CONTENT CALENDAR — [Brand Name]
 Period: [start date] → [end date]  |  Goal: [goal]
──────────────────────────────────────────

WEEK 1 — THEME: [theme name]
Focus: [week focus statement]

  MON [date]
    LinkedIn: Educational post — "3 ways [brand solves problem]"
    Instagram: Brand story — "[founder/team moment]"

  WED [date]
    LinkedIn: Case study hook — "[client result in numbers]"
    Instagram: Tip carousel — "[3-5 tips related to USP]"
    Facebook: Community question — "[discussion starter]"

  FRI [date]
    Instagram: Social proof — "[review or result]"
    TikTok: "[quick tip or behind-the-scenes script]"
    X: Thread — "[educational thread on core topic]"

WEEK 2 — THEME: [theme name]
...

──────────────────────────────────────────
CAMPAIGN SUMMARY
  Total posts: [count]  |  Platforms: [count]
  Content types: [breakdown]
  Key conversion dates: [list]
──────────────────────────────────────────

→ Generate content for all slots?
→ Or start with Week 1 only?
```

## Batch Content Generation

After calendar approval, offer to generate content for each slot:

- Call `brand-campaign-generator` skill for each week as a batch
- Score all generated content via `lib/ai/content-scorer.ts`
- Flag any posts scoring below 75 for human review
- Pre-schedule approved posts via `POST /api/schedule`

## Key Content Hooks by Goal

**Product Launch:**
- Week 1: Tease ("something's coming")
- Week 2: Reveal + benefits
- Week 3: Social proof + early access
- Week 4: Launch day + urgency + FOMO

**Brand Awareness:**
- Rotate: founder story → customer story → educational → behind the scenes

**Lead Generation:**
- Lead magnet → social proof → FAQ → offer → testimonial → offer

**Seasonal:**
- Pre-season (awareness) → peak (conversion) → post-season (retention)

## Reference

- Business DNA: `.claude/skills/business-dna/`
- Content generation: `.claude/skills/brand-campaign-generator/`
- Platform adaptor: `.claude/skills/platform-content-adaptor/`
- Scheduling API: `app/api/schedule/`
- Analytics (for timing optimisation): `app/api/analytics/`
