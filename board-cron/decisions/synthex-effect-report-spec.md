# Synthex Effect Report — Product Specification

**Version:** 1.0 (Sprint 5 — for Sprint 6 implementation)
**Status:** Draft — awaiting Phill approval
**Deliverable of:** SYN-639

---

## Overview

The Synthex Effect Report is a monthly client-facing document that translates raw marketing data into plain-English business impact. It is designed for the "plumber in Ballarat" — a time-poor small business owner who needs to see whether Synthex is making them money or saving them time, without needing to understand marketing metrics.

The report is:
- Generated automatically at month end
- Delivered via email (HTML) and available in-app
- Shareable as a PNG card (1200×630px)
- Designed to drive referrals and reduce churn

---

## Report Sections

Each section below documents: data source, plain-English translation rule, fallback if unavailable, and visual design intent.

---

### Section 1: Cover

**Purpose:** Cumulative proof-of-value snapshot. Shows the client everything Synthex has done for them since day one.

#### Data Points

| Metric | Data Source | Plain-English Label |
|--------|-------------|---------------------|
| Months with Synthex | `organizations.created_at` → months since join date | "X months of Synthex" |
| Total posts published | `posts` WHERE `organization_id = :org AND status = 'published'` | "X posts published for your business" |
| Total cumulative reach | `platform_metrics.reach` SUM since join date | "X people reached in total" |
| Total reviews responded to | `gbp_reviews` WHERE `response_status = 'responded'` | "X reviews responded to" |
| Synthex IQ score | Computed (see Synthex IQ definition below) | "Your Synthex IQ: [score]" |
| Join date | `organizations.created_at` | "Member since [Month YYYY]" |

**Plain-English Translation Rules:**
- Reach → "X people have seen your content" (never "impressions" or "reach")
- Posts → "X posts published for your business" (never "content pieces" or "assets")
- Reviews → "X customers heard back from you via Synthex" (never "responses" or "GBP interactions")

**Fallback:** If any metric is unavailable (e.g., no platform connection yet), display "—" with tooltip: "Connect your platforms to see this."

**Visual Design Intent:**
- Hero number treatment — large type, high contrast
- Synthex IQ is the centrepiece: circular badge, prominent
- Join date is quiet — small, bottom of cover section
- Standout badge (if eligible) appears on cover (see Section 8)

---

### Section 2: Monthly Metrics Grid

**Purpose:** This month's performance at a glance — direction, not raw numbers.

#### Data Points

| Metric | Data Source | Plain-English Label |
|--------|-------------|---------------------|
| Posts published (this month) | `posts` WHERE `published_at >= start_of_month` | "X posts this month" |
| Reach total (this month) | `platform_metrics.reach` SUM for current month | "X people reached this month" |
| Engagement rate trend | `platform_metrics.engagement_rate` — direction only | "Your engagement is [up/down/stable]" |
| Reviews responded to (this month) | `gbp_reviews` WHERE `responded_at >= start_of_month` | "X reviews replied to this month" |
| Authority Score direction | `authority_scores` — only show if positive | "More people are finding you on Google" |

**Plain-English Translation Rules:**
- Engagement rate → direction ONLY, never show the raw percentage
  - Up (> 5% increase): "Your engagement is up this month"
  - Down (> 5% decrease): "Your engagement dipped slightly this month"
  - Stable (within 5%): "Your engagement is holding steady"
- Authority Score → ONLY shown if positive direction: "More people are finding you on Google this month"
  - If neutral or declining: OMIT ENTIRELY (do not show negative signal)
  - Rationale: clients cannot act on declining authority in a monthly report; showing decline creates anxiety without actionability

**Fallback:**
- Engagement trend: if < 3 data points available for trend calculation, show "Not enough data yet — check back next month"
- Authority Score: if no data, omit section silently

**Visual Design Intent:**
- 2×2 or 2×3 grid of metric tiles
- Each tile: large number + small plain-English label below
- Engagement tile: directional arrow icon (up/down/right) instead of percentage
- Authority Score tile (if shown): Google Maps pin icon

---

### Section 3: Content Intelligence Highlights

**Purpose:** Explain what's working and confirm Synthex is learning and adapting.

#### Data Points

| Metric | Data Source |
|--------|-------------|
| Top-performing content type | `content_performance_profiles.top_content_type` |
| Optimal posting time | `content_performance_profiles.optimal_posting_schedule` |
| Strategy changes this month | `content_performance_profiles.profile_version` change log, `personalisation_activated` events |

**Plain-English Translation Rules:**
- Top content type → "Your posts about [topic] are performing 3× better than your other content"
  - Multiplier is derived from `improvement_rate` in `content_improvement_tracking`
  - Cap multiplier display at "10×" — anything higher reads as implausible to a small business owner
- Optimal posting time → "We've found [Day], [time] is when your audience is most active. Your calendar has been updated."
- Strategy changes → "This month, Synthex updated your content plan [N] time(s) based on what's working."
  - If N = 0: "Your current strategy is running well — no changes needed this month."

**Fallback:**
- If `content_performance_profiles` has no data for org: "We're still learning your audience. Check back next month for personalised insights."
- If improvement_rate unavailable: show content type highlight without the multiplier

**Visual Design Intent:**
- Highlighted callout box — visually distinct from metrics grid
- Pull-quote style: large italic text for the key insight
- Small "Synthex is learning" label or icon to reinforce the AI personalisation narrative

---

### Section 4: Authority Score Trajectory

**Purpose:** Visual proof of Google visibility growth over time.

#### Data Points

| Metric | Data Source |
|--------|-------------|
| Authority score, last 3 months | `authority_scores` WHERE `organization_id = :org ORDER BY recorded_at DESC LIMIT 3` |
| Month labels | Derived from `recorded_at` |

**Plain-English Translation Rules:**
- Chart label: "Your Google visibility trend" (never "Authority Score" or "DA/PA")
- X-axis: month names (e.g., "Jan", "Feb", "Mar") — never timestamps
- Y-axis: no numbers shown to client (relative change only)
- Rising line: "Your Google presence has grown this month."
- Flat line: "Your Google presence is holding steady."
- Declining line: shown but softened — "Google visibility can fluctuate. Your content is building long-term equity."

**Fallback:**
- If < 2 months of data: show a single point with label "Your baseline has been set. We'll track progress from here."
- If `authority_scores` table has no records for org: omit section entirely

**Visual Design Intent:**
- Minimal line chart — no gridlines, no axis numbers
- Smooth curve (cubic bezier) — looks premium, less clinical than bar charts
- Highlight the most recent point with a dot and value indicator
- Colour: Synthex brand gradient (teal → blue direction = growth)

---

### Section 5: Attribution Estimate

**Purpose:** Dollar value of Synthex's contribution to the client's marketing — the "is this making me money?" answer.

**CRITICAL: This section is ONLY shown if the SYN-622 attribution validation gate has passed (80% accuracy threshold confirmed).**

#### Data Points

| Metric | Data Source |
|--------|-------------|
| Monthly attribution estimate | SYN-622 attribution engine output |
| Confidence level | Attribution engine confidence score |
| Attribution events tracked | `attribution_events` COUNT for org this month |

**Plain-English Translation Rules:**
- Primary label: "Synthex content contributed an estimated $[X] in marketing value this month."
- If confidence < 90%: add visible qualifier — "This is an estimate. Accuracy improves as we track more of your customers."
- If confidence ≥ 90%: no qualifier needed
- Dollar figure: always round to nearest $50 — false precision undermines trust
- "Marketing value" is defined internally as equivalent cost-per-click value of organic reach achieved; never explain the methodology to the client

**Fallback:**
- If SYN-622 gate NOT passed: omit section entirely, no placeholder or mention
- If confidence < 60%: omit section (threshold too low to be credible)
- If attribution events tracked = 0: omit section

**Visual Design Intent:**
- Premium highlighted box — visually the most prominent section
- Large dollar figure — this is the "wow" moment
- Confidence qualifier (if shown): small text, below the dollar figure, not alarming
- Lock icon or "early estimate" badge if below 90% confidence

---

### Section 6: Health Score Trend

**Purpose:** Internal system health translated into client-friendly language — confirms Synthex is running reliably for them.

#### Data Points

| Metric | Data Source |
|--------|-------------|
| Health score, last 3 months | `health_score_computations` WHERE `organization_id = :org ORDER BY computed_at DESC LIMIT 3` |
| Current score | Most recent `health_score_computations.score` |

**Plain-English Translation Rules:**
- Clients NEVER see the raw health score number
- Below threshold (score < 70): OMIT SECTION ENTIRELY — do not surface internal failures in a client report
- Stable (score 70–85, variance < 5 points): "Your marketing is running consistently."
- Rising (score > 85 or trending up ≥ 5 points): "Your marketing engine is running at peak performance."
- The health score is an internal metric — its value is in confirming reliability, not diagnosing problems

**Fallback:**
- If `health_score_computations` has no data for org: omit section silently
- If below threshold: omit section (no mention, no placeholder)

**Visual Design Intent:**
- Simple status indicator — green dot + one sentence
- Not a chart (avoids clients asking "what does this mean?")
- Positioned after the high-value sections (attribution, authority) — it's a confidence signal, not the headline

---

### Section 7: Closing Section

**Purpose:** Reinforce cumulative value and drive referrals.

#### Data Points

| Metric | Data Source |
|--------|-------------|
| Total Synthex actions since join | Synthex IQ computation (sum of all scored events) |
| Join date | `organizations.created_at` |
| Referral prompt eligibility | Configurable — shown if `months_active >= 2` |

**Cumulative Impact Statement:**
> "Synthex has invested [X] marketing actions into your business since [Month YYYY]."

Where [X] = total Synthex IQ points earned (see Synthex IQ definition).

**Referral Prompt (optional — shown if eligible):**
- Trigger: `months_active >= 2` AND current month's report shows positive trajectory
- Copy: "Happy with your results? Help another local business discover Synthex."
- CTA: "Share your results" → opens referral flow (or testimonial card share sheet)
- Opt-in only: client must tap/click — never auto-shared

**Fallback:**
- Referral prompt: omit if `months_active < 2`
- Impact statement: always shown (fallback to "We've published X posts for your business since [date]" if IQ computation unavailable)

**Visual Design Intent:**
- Warm, conversational tone — not corporate
- Referral prompt: subtle, not pushy — text link style, not a button
- Closing signature: "The Synthex Team" or brand mark

---

## Synthex IQ Definition

Synthex IQ is a composite engagement score that measures the cumulative investment Synthex has made into a client's marketing. It is **monotonically increasing** — it never resets or decreases.

### Scoring Formula

| Event | Points | Source |
|-------|--------|--------|
| Post published | 2 pts each | `posts WHERE status = 'published'` |
| Review responded to | 3 pts each | `gbp_reviews WHERE response_status = 'responded'` |
| Auto-Calendar strategy update | 5 pts each | `personalisation_activated` events in `content_learning_events` |
| Attribution event tracked | 1 pt each | `attribution_events` |

### Client-Facing Display

**Label:** "Your Synthex IQ: [score]"

**Anchor text:** "Synthex has invested [X] marketing actions into your business since [join_date]."

### Design Notes
- IQ score is always shown as a whole number (no decimals)
- No upper bound — the score grows indefinitely, which is the point
- Score is additive across all organisations for a user (future: when multi-location is supported)
- The "IQ" framing is intentional: it positions Synthex as getting smarter about the client's business over time

### Sprint 6 Feature Note
Synthex IQ computation and display is a **Sprint 6 feature**. In Sprint 5, the underlying event data is being captured; the display layer is built in Sprint 6.

---

## Shareable Testimonial Card

### Specification

| Property | Value |
|----------|-------|
| Format | Static PNG |
| Dimensions | 1200×630px (Open Graph standard) |
| Generation method | `@vercel/og` (Next.js API route) — no puppeteer/playwright |
| Default content | Business type/industry only (NOT business name) |
| Watermark | Synthex logo, bottom right |
| Date | Month + Year, bottom left |

### Content Fields

**Always included:**
- Business type / industry (e.g., "Local Plumber", "Café Owner") — NOT the business name by default
- One key metric (highest-impact result from the month, selected automatically)
- Synthex logo watermark
- Month + Year

**Optional — client can add:**
- Business name
- City / region
- Business photo or logo (uploaded by client)

### Distribution

**Default:** No public URL — client downloads PNG directly from in-app report page or email CTA.

**Opt-in public link:** `synthex.social/results/[token]`
- Requires explicit consent checkbox: "I agree to share my results publicly on synthex.social"
- Token is a secure random string (32 chars), not sequential ID
- Public page shows testimonial card + basic context
- Sprint 6+ feature — not in Sprint 5

**One-tap share:**
- Tapping/clicking "Share your results" opens the native share sheet on mobile
- PNG pre-attached to share sheet
- Pre-populated caption: "My business saw [metric] with @Synthex this month. [URL if opted in]"

### Generation API

```
POST /api/reports/[org-id]/testimonial-card
Response: PNG binary (Content-Type: image/png)
```

Parameters:
- `month` (YYYY-MM)
- `include_business_name` (boolean, default false)
- `include_location` (boolean, default false)
- `custom_logo_url` (optional)

---

## Standout Result Badge

### Trigger Conditions

- Client ranks in **top 20%** by `improvement_rate` within their `industry_vertical` for the current month
- `improvement_rate` sourced from `content_improvement_tracking` table (SYN-632)
- Minimum pool size: 5 clients in the same industry vertical (no badge if sample too small)
- Industry vertical derived from `organizations.industry` field

### Badge Content

**On cover section:**
> "Your results this month ranked in the top 20% of Synthex clients in [industry]."

Where [industry] is the plain-English industry label (e.g., "trades", "hospitality", "retail").

### Opt-in Social Card Trigger

- If badge is earned AND `months_active >= 1`: trigger testimonial card CTA with badge integrated
- Badge appears on the testimonial card PNG as a ribbon/stamp element
- Badge is opt-in for sharing — never auto-published

---

## Data Dependency Map

| Section | Data Source | Available From |
|---------|-------------|----------------|
| Cumulative counter | `posts`, `gbp_reviews`, `organizations.created_at` | Now (SYN-638) |
| Synthex IQ | All scored events (posts, reviews, personalisation, attribution) | Sprint 6 W1 (data captured in Sprint 5) |
| Authority Score trajectory | `authority_scores` | Sprint 3 (live) |
| Content Intelligence highlights | `content_performance_profiles` | SYN-631 (Sprint 5 W1) |
| Health Score trend | `health_score_computations` | SYN-611 (Sprint 5 W1) |
| Attribution estimate | SYN-622 attribution engine + accuracy gate | SYN-622 gate (Sprint 5/6) |
| Standout badge | `content_improvement_tracking.improvement_rate` | SYN-632 (Sprint 5) |
| Testimonial card (basic) | Any available metric | Sprint 6 W1 |
| Testimonial card (public link) | Client opt-in + consent flow | Sprint 6+ |

---

## Sprint 6 Implementation Estimates

| Component | Estimate |
|-----------|----------|
| Report data aggregation Edge Function | 2 days |
| Report HTML email template | 2 days |
| In-app report page (dashboard) | 2 days |
| Testimonial card PNG generation (`@vercel/og`) | 1 day |
| Synthex IQ computation and display | 1 day |
| Standout badge trigger | 0.5 days |
| **Total** | **~8.5 days** |

### Dependencies (must be done before Sprint 6 report work begins)
1. SYN-631 (content_performance_profiles) — confirmed Sprint 5 W1
2. SYN-611 (health_score_computations) — confirmed Sprint 5 W1
3. SYN-622 (attribution engine + gate) — confirm gate status before showing attribution section
4. SYN-638 (cumulative counters baseline) — confirm available before Sprint 6

---

## Plain-English Rules (Non-Negotiable)

Every data point in this report must pass the **"plumber in Ballarat" test**:

> "If a plumber in Ballarat read this at 7pm after a 10-hour day, would they understand it in under 5 seconds?"

### Rules

1. **Zero metric names visible to client.** No "engagement rate", no "authority score", no "LUFS", no "impressions". Translate everything.

2. **Zero raw percentages without a plain-English equivalent.** If you must show a percentage, follow it immediately with: "that means X".

3. **If a data point can't answer "is this making me money?" or "is this saving me time?" → omit it.**

4. **Negative signals are contextualised or omitted.** Clients cannot act on most negative signals in a monthly report. Showing them creates anxiety without actionability.

5. **Numbers are rounded to the nearest sensible unit.** Reach of 4,723 → "nearly 5,000 people". Revenue attribution of $847 → "$850".

6. **One insight per section maximum.** Don't try to tell the client everything. One clear takeaway per section.

---

## Technical Feasibility Notes (Lead Developer Review)

These notes are for the developer implementing Sprint 6, not for client-facing output.

### No new Supabase tables required for Phase 1

All data sources are existing tables:
- `posts` — already indexed on `organization_id`, `status`, `published_at`
- `gbp_reviews` — already indexed on `organization_id`, `response_status`, `responded_at`
- `authority_scores` — already available (Sprint 3)
- `content_performance_profiles` — available post-SYN-631
- `health_score_computations` — available post-SYN-611
- `content_improvement_tracking` — available post-SYN-632
- `attribution_events` — available post-SYN-622

### PNG Generation

Use `@vercel/og` (already available in Next.js 15). This avoids:
- Puppeteer/Playwright cold start issues on Vercel serverless
- Binary dependency headaches
- 250MB function size limit violations

`@vercel/og` generates PNG from JSX via Satori — sub-100ms on Vercel Edge.

### Query Performance at Scale (100+ clients)

All aggregation queries use existing indexed columns:
- `posts`: `(organization_id, status, published_at)` — index exists
- `gbp_reviews`: `(organization_id, response_status)` — index exists
- `authority_scores`: `(organization_id, recorded_at)` — confirm index before Sprint 6

Monthly report generation should be triggered by a Supabase Edge Function cron (first day of each month) rather than on-demand, to avoid slow load times for clients.

### Synthex IQ Computation

Synthex IQ can be computed as a single aggregation query across 4 tables. Recommend materialising as a `synthex_iq_cache` table updated daily (not per-request) for performance.

### `improvement_rate` for Standout Badge

Available from `content_improvement_tracking` table (SYN-632). Percentile calculation requires a minimum of 5 orgs in the same `industry_vertical` — add a guard clause before attempting percentile ranking.

### Testimonial Card Public Link

Implement token as `encode(gen_random_bytes(32), 'hex')` in PostgreSQL. Store in `effect_report_tokens` table with `organization_id`, `month`, `token`, `created_at`, `consent_given_at`. Revocable by client at any time.
