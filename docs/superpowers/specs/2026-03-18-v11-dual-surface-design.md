# Synthex v11.0 — Dual Surface Enhancement Design Spec

**Date:** 2026-03-18
**Status:** Approved by product owner
**Milestone:** v11.0 "Dual Surface"
**Approach:** Brand DNA First

---

## Overview

Synthex v11.0 introduces a dual-surface product model: **Simple Mode** for SMB owners (cafés, tradies, salons, gyms) and **Pro Mode** for agencies and power users. Both surfaces are built on a shared **Brand DNA Engine** — a structured brand profile extracted automatically from the client's website URL. A new design system replaces the existing navy/cyan palette with gunmetal-based surfaces differentiated by accent temperature.

---

## 1. Brand DNA Engine

### Purpose

The Brand DNA Engine is the data backbone of the entire platform. It runs at URL entry and produces a structured brand profile that every downstream system reads from — post generation, GEO strategy, analytics framing, scheduling defaults, and the dashboard greeting.

### Extracted Signals

| Signal              | Source                                     | Method                                                          |
| ------------------- | ------------------------------------------ | --------------------------------------------------------------- |
| Business name       | `<title>`, OG tags, H1                     | Parse + AI confirm                                              |
| Industry / vertical | Page copy + structured data                | AI classification (café, tradie, salon, gym, etc.)              |
| Logo                | `<link rel="icon">`, OG image, header scan | Image extraction + hosted copy                                  |
| Brand colours       | CSS variables, hero images, logo           | Colour extraction → primary + secondary + neutral               |
| Brand voice         | Hero copy, About page, reviews             | AI tone analysis → 5-point scale (formal↔casual, reserved↔bold) |
| Target persona      | Page copy, product descriptions            | AI persona inference → age, values, pain points                 |
| Offerings           | Products/services pages, nav items         | Extracted list with descriptions                                |
| Social profiles     | Footer links, meta tags                    | Auto-detected + verified                                        |
| SEO health score    | Title tags, meta, H structure              | Lightweight technical audit                                     |

### Data Model

New `BrandDNA` Prisma model attached to each `Organization`:

```prisma
model BrandDNA {
  id              String   @id @default(cuid())
  organizationId  String   @unique
  organization    Organization @relation(fields: [organizationId], references: [id])
  businessName    String
  industry        String
  vertical        String   // café | tradie | salon | gym | other
  logoUrl         String?
  primaryColour   String?  // hex
  secondaryColour String?
  neutralColour   String?
  brandVoice      Json     // { formality: 1-5, boldness: 1-5, tone: string }
  persona         Json     // { ageRange: string, values: string[], painPoints: string[] }
  offerings       Json     // string[]
  socialProfiles  Json     // { platform: string, url: string, verified: boolean }[]
  seoScore        Int?     // 0-100
  extractedAt     DateTime @default(now())
  lastRefreshedAt DateTime @default(now())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Extraction Pipeline

- **Endpoint:** `POST /api/brand-dna/extract` — accepts `{ url, organizationId }`
- **Instant preview path (≤3s):** Extract business name + industry + hero copy → generate Post #1 → return `{ preview: Post, status: 'extracting' }`
- **Full extraction path (15–20s):** Complete all signals → store `BrandDNA` → push completion event via **SSE** (same pattern as AI chat streaming in `app/api/ai-chat`) → client updates UI when `status: 'complete'` received. Polling fallback at 3s intervals if SSE connection drops.
- **Re-extraction:** `POST /api/brand-dna/refresh` — triggered manually from settings or scheduled weekly

### Connection to existing systems

- `app/dashboard/settings/brand-profile/page.tsx` — becomes the Brand DNA editor (connected to this model as source of truth)
- All AI post generation reads `BrandDNA` before generating content
- GEO readiness audit uses `vertical` + `persona` for scoring context

---

## 2. Onboarding Flow

### Entry Point

Landing page primary CTA navigates to a full-screen URL entry experience at `/onboarding` (replaces current multi-step wizard entry):

```
"Enter your website URL"
[ https://jakes-cafe.com.au        → ]
"We'll build your brand profile in seconds. No card needed."
```

### Instant Preview (wow moment — ≤3 seconds)

1. User submits URL
2. System immediately fetches + parses (business name, industry, hero copy)
3. AI generates Post #1 using partial data
4. Preview displayed before full pipeline completes:

```
✨ Here's your first post — written for Jake's Café

"Monday mornings hit different with our house blend ☕
First coffee before 9am is on us this week — come say hi."

[ Approve & Schedule ]  [ Tweak it ]
```

5. Full Brand DNA pipeline runs in background (15–20s) with subtle status indicators — not a blocking spinner

### Review Screen (`/onboarding/review`)

- Shows extracted Brand DNA for user verification
- All fields editable — user role is "check and confirm", not "fill from scratch"
- Sections: Business Identity · Brand Colours · Voice & Persona · Offerings · Detected Social Profiles

### Platform Connect (`/onboarding/connect`)

- OAuth for **primary platform only** (not all 9) — reduces friction
- After first connection → redirected to Simple Mode home
- Remaining platforms prompted progressively via stickiness mechanics

---

## 3. Simple Mode

### Target User

SMB owner (café, tradie, salon, gym). Non-technical. Time-poor. Wants social media handled, not learned.

### Home Screen — Approval Inbox

```
Good morning, Jake.  ·  🔥 14-day streak

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TODAY'S POST                  Instagram · posts in 2h
──────────────────────────────────────────────────────
"Monday special: our house blend is back ☕
Come in before 10am for 20% off. Tag someone
who needs this."

[ ✓ Approve & Post ]   [ Edit ]   [ Skip ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This week: 3 of 5 posts approved · 2 pending
```

### Post Generation Cadence

Posts are AI-generated **nightly by a cron job** (runs 2am local time) using the organisation's `BrandDNA` profile + connected platform + upcoming calendar gaps. The cron generates 7 days of posts at a time, storing them as `Post` records with status `pending_approval`. The approval inbox displays the next unnapproved post for today. If the user skips or edits, the next post in the queue surfaces the following day. If no posts are queued (e.g., onboarding day 1), a post is generated on-demand when they first open the inbox.

### Navigation

Four items only — no sidebar, no 60-page menu:

1. **Today** — the approval inbox
2. **This Week** — week view of scheduled + pending posts
3. **Results** — 3-stat summary (reach, engagement, best post)
4. **Settings** — brand profile, platform connections, plan

### Design Tokens — Simple Mode

| Token          | Value                                      |
| -------------- | ------------------------------------------ |
| Background     | `#202124`                                  |
| Surface        | `#2b2d31`                                  |
| Accent         | `#a8845c` (champagne bronze)               |
| Accent subtle  | `rgba(168,132,92,0.15)`                    |
| Accent border  | `rgba(168,132,92,0.35)`                    |
| Text primary   | `#e8e0d4` (warm ivory)                     |
| Text secondary | `rgba(232,224,212,0.4)`                    |
| CTA            | Ghost button — bronze border + bronze text |

### Upgrade Prompt (non-intrusive)

When a Simple Mode user encounters a Pro feature: single inline callout — _"This is a Pro feature — see what you're unlocking."_ No modal. No hard block. Curiosity over friction.

---

## 4. Pro Mode

### Target User

Marketing agency, growth-stage business, power user. Wants full control, deep analytics, team features, GEO tooling.

### Home Screen

Same information architecture as current Command Centre (5 tabs: Overview, Analytics, AI Studio, Team, Scheduler). Brand DNA prominently surfaced. Density is the feature.

### Design Tokens — Pro Mode

| Token          | Value                       |
| -------------- | --------------------------- |
| Background     | `#1c1b1e` (deeper gunmetal) |
| Surface        | `#252428`                   |
| Accent         | `#f59e0b` (amber gold)      |
| Accent subtle  | `rgba(245,158,11,0.1)`      |
| Accent border  | `rgba(245,158,11,0.2)`      |
| Text primary   | `rgba(255,255,255,0.85)`    |
| Text secondary | `rgba(255,255,255,0.35)`    |
| Data highlight | `#f59e0b`                   |

### Mode Indicator

Persistent pill top-right: `PRO MODE` in amber. Non-interactive — informational only.

### Plan Gate

- **Starter plan** → Simple Mode only
- **Pro plan** → Pro Mode (full platform)
- **Agency plan** → Pro Mode + white-label + multi-client management
- Upgrade from Simple Mode via Settings → Plan → upgrade CTA

---

## 5. Stickiness System

Three mechanics operating on different emotional registers and cadences:

### Mechanic 1 — Streak (daily discipline)

- Visible in Simple Mode header every day
- Breaks if no post approved by midnight (user's timezone)
- Email + push notification at 8pm: _"Your streak is at risk — one tap to keep it alive"_
- Milestone celebrations at 7, 30, 90 days (in-app + email)
- Data stored on `Organization` model: `streakCount Int`, `lastApprovedAt DateTime`, `longestStreak Int`, `timezone String @default("Australia/Sydney")`
- Timezone resolved from: (1) user-set value in Settings, (2) inferred from website URL's country TLD during Brand DNA extraction, (3) default `Australia/Sydney`

### Mechanic 2 — Weekly Results Report (Monday reflection)

- Delivered via email + in-app notification every Monday 8am local time
- Content: Total reach · Best post · Engagement rate vs prior week
- One AI-generated sentence: _"Your Tuesday posts outperform Wednesday by 40% — we've shifted your schedule"_
- Deep link directly to approval inbox — not the full dashboard
- Powered by existing scheduled report infrastructure

### Mechanic 3 — Smart Alerts (real-time wins)

- Triggered when a post exceeds 2× the user's average engagement
- Notification: _"Your café post is performing 3× above average — here's why"_
- Links to single-post analytics view (not full analytics dashboard)
- Maximum 1 alert per day per user to prevent noise
- Routed through existing `NotificationBell` + Redis-cached unread count (Phase 121)

---

## 6. SEO / AEO / GEO Strategy

Three phases executed in sequence — each builds on the prior:

### Phase 1 — Category Ownership

Target every local business vertical by name:

- Blog posts + dedicated landing pages: `/for/cafes`, `/for/tradies`, `/for/salons`, `/for/gyms`
- `LocalBusiness` + `SoftwareApplication` JSON-LD schema on all vertical pages
- Each vertical page includes a live Brand DNA demo seeded with that business type
- Keyword targets: "AI social media for cafés", "social media automation for tradies", etc.

### Phase 2 — Comparison Dominance

- Pages: `/vs/buffer`, `/vs/hootsuite`, `/vs/later`, `/vs/sprout-social`
- Structured as `FAQPage` + comparison table schema
- Written to answer AI search directly: _"which is better for small business?"_
- Updated quarterly

### Phase 3 — Proof Pages

- `/results/[client-slug]` — real outcomes with specific numbers (with permission)
- `Article` + `Review` schema
- Seeded from anonymised real user data
- These are the pages AI search engines (Perplexity, ChatGPT, Claude) will cite

### Synthex Eating Its Own Cooking

- Point Synthex's own GEO Readiness dashboard at `synthex.social`
- Track and optimise Synthex's AI citability score the same way the tool does for clients
- Screenshot results and use them as marketing proof

---

## Implementation Phases (for writing-plans)

### Phase A — Brand DNA Engine

- `BrandDNA` Prisma model + migration
- `POST /api/brand-dna/extract` endpoint (instant preview + full pipeline)
- `POST /api/brand-dna/refresh` endpoint
- Connect `app/dashboard/settings/brand-profile` to `BrandDNA` as source of truth
- Wire AI post generation to read `BrandDNA` context

### Phase B — Onboarding Redesign

- Redesign `/onboarding` as URL-first entry with instant preview
- Update `/onboarding/review` to show extracted Brand DNA
- Update `/onboarding/connect` to OAuth one platform only

### Phase C — Simple Mode Surface

- New layout/route group for Simple Mode (`app/(simple)/`)
- Approval inbox home screen
- 4-item navigation
- Gunmetal + Champagne Bronze design tokens
- Plan-tier gate (Starter → Simple Mode)

### Phase D — Design System Migration

- New design token file: `lib/design-tokens.ts` — Simple + Pro palettes
- Apply Pro Mode (Amber Gold) tokens across existing dashboard
- Replace navy/cyan accent tokens progressively

### Phase E — Stickiness System

- Streak tracking on `Organization` model
- Weekly report cron + email template
- Smart alert trigger on engagement threshold
- All three wired to `NotificationBell`

### Phase F — SEO/AEO Content Infrastructure (separate track — runs in parallel to A–E, not a dependency)

> Note: Phase F is content/marketing engineering, not product engineering. It does not block any of Phases A–E and should be planned and executed as an independent workstream by a separate agent.

- Vertical landing pages (`/for/[vertical]`)
- Comparison pages (`/vs/[competitor]`)
- Results pages (`/results/[slug]`)
- Schema markup on all new pages
- GEO self-audit setup for synthex.social

---

## Out of Scope (v11.0)

- Full redesign of all 60+ existing Pro Mode pages (design tokens applied, layout unchanged)
- Native mobile app
- New social platform integrations
- Pricing changes

---

## Success Metrics

- Simple Mode daily approval rate ≥ 60% of active Starter users
- Onboarding completion rate (URL → first post approved) ≥ 70%
- 7-day streak retention ≥ 40% of users who reach day 3
- Synthex GEO citability score ≥ 75 (measured by own tool)
- Organic search traffic from vertical pages within 90 days of launch
