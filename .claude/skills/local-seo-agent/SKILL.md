---
name: local-seo-agent
description: >-
  Orchestrates google-search-console, google-business-profile,
  competitive-local-strategy, and google-updates-sentinel skills into a unified
  local SEO strategy with monthly audit cadence. Use when running local SEO
  campaigns, onboarding new clients, or performing monthly audits.
metadata:
  author: synthex
  version: '1.0'
  engine: synthex-ai-agency
  type: reference-skill
  triggers:
    - local SEO
    - local search
    - local marketing
    - service area
    - citation building
    - local keywords
    - maps optimisation
    - local audit
    - suburb targeting
  requires:
    - google-search-console
    - google-business-profile
    - competitive-local-strategy
    - google-updates-sentinel
context: fork
---

# Local SEO Agent — Unified Local Search Strategy

## Purpose

This is the overarching strategy skill that orchestrates all 4 local SEO skills
into a unified local search campaign for Australian SMBs. It provides the
workflows for client onboarding, keyword research, content creation, citation
building, and ongoing monthly audits.

## New Client Onboarding Decision Tree

```
New business connecting to Synthex?
  |
  Step 1: Connect Google Search Console
  |   OAuth flow --> syncProperties via useGSCProperties
  |   Verify primary property is set
  |
  Step 2: Connect Google Business Profile
  |   OAuth flow --> syncLocations via useGBPLocations
  |   Verify primary location is set
  |
  Step 3: Run 28-day GSC baseline
  |   fetchAnalytics(siteUrl, { dimensions: ['query', 'page'] })
  |   Record: total clicks, total impressions, avg position, top queries
  |   This becomes the benchmark for all future reporting
  |
  Step 4: Run GBP listing optimisation checklist
  |   See google-business-profile skill -- 12-point checklist
  |   Fix any gaps immediately (categories, hours, description, photos)
  |
  Step 5: Run competitive audit
  |   addCompetitor for 3-5 local competitors
  |   generateBenchmarkReport to establish competitive baseline
  |   identifyContentGaps to find opportunity areas
  |
  Step 6: Establish Sentinel monitoring
  |   runSentinelCheck(userId, orgId) to create first health snapshot
  |   Verify crons are running (gsc-monitor 4AM, gbp-monitor 5AM, sentinel)
  |
  Step 7: Generate first month plan from gaps
       Combine: GSC quick wins + GBP fixes + competitive gaps
       Prioritise by impact and effort
       Output: 4-week action plan
```

## Local Keyword Research Methodology

### Step 1: Extract Current Queries from GSC

```
fetchAnalytics(siteUrl, {
  dimensions: ['query'],
  rowLimit: 1000,
})
```

Export the full query list. Categorise each by intent and local relevance.

### Step 2: Identify Local Modifiers

For each core service, create keyword variants:

- "[service] [suburb]" — e.g. "plumber Parramatta"
- "[service] near me" — e.g. "plumber near me"
- "[service] [region]" — e.g. "plumber western Sydney"
- "best [service] [suburb]" — e.g. "best plumber Parramatta"
- "[service] [suburb] reviews" — e.g. "plumber Parramatta reviews"

### Step 3: Cross-Reference Competitor Gaps

Use `identifyContentGaps` from `competitive-local-strategy` skill.
Topics covered by 3+ competitors with >5% engagement that you do not cover = priority targets.

### Step 4: Categorise by Intent

| Intent        | Pattern                                               | Page Type               |
| ------------- | ----------------------------------------------------- | ----------------------- |
| Transactional | "hire [service]", "[service] quote", "book [service]" | Service page with CTA   |
| Informational | "how to [topic]", "what is [topic]", "[topic] guide"  | Blog post or FAQ        |
| Navigational  | "[business name]", "[business name] reviews"          | Homepage or GBP listing |
| Local         | "[service] [suburb]", "near me"                       | Service-area page       |

### Step 5: Map Keywords to Pages

Each target keyword needs a dedicated page. Never target the same keyword on multiple pages (cannibalisation). Create a keyword-to-URL mapping document.

## Service-Area Page Structure

### Template

```
H1: [Service] in [Suburb], [State]

[Unique introduction -- 150-200 words. Never duplicate across suburb pages.
Reference specific local landmarks, demographics, or common issues in this area.]

H2: Our [Service] Services in [Suburb]
[Detailed service descriptions with local knowledge. What makes this area
different? What problems do customers in this suburb commonly face?]

H2: Why Choose [Business] for [Service] in [Suburb]
[Differentiators, experience in this area, local knowledge]

[Embedded Google Map using GBPLocation coordinates]

H2: What Our [Suburb] Customers Say
[Local testimonials -- filter GBPReview records by suburb mention in comment]

[NAP Block -- matching GBP exactly]

[LocalBusiness Schema Markup -- JSON-LD]
```

### Anti-Pattern: Thin Suburb Pages

NEVER create pages that are identical content with only the suburb name swapped.
This is a thin content signal that triggers the helpful content classifier.

Each suburb page must have:

- Unique introduction referencing the actual suburb
- Local-specific service details
- Genuine local testimonials or case studies
- Original photos from that service area if possible

## Citation Building Workflow

### Priority 1: Major Australian Directories

| Directory                           | Type             | Action                             |
| ----------------------------------- | ---------------- | ---------------------------------- |
| Google Business Profile             | Map/Search       | Already managed via Synthex        |
| Apple Maps / Apple Business Connect | Map              | Submit via Apple Business Register |
| Bing Places for Business            | Map/Search       | Submit via Bing Places portal      |
| Yellow Pages Australia              | Directory        | Claim or create listing            |
| True Local                          | Directory        | Claim or create listing            |
| Hotfrog                             | Directory        | Claim or create listing            |
| StartLocal                          | Directory        | Claim or create listing            |
| Yelp Australia                      | Directory/Review | Claim or create listing            |

### Priority 2: Industry-Specific

Lookup table by vertical (from `competitive-local-strategy` skill):

- Tradies: HiPages, ServiceSeeking, Oneflare, Airtasker
- Medical: HealthEngine, HotDoc, RateMDs
- Legal: Law Society (state), FindLaw Australia
- Hospitality: TripAdvisor, Zomato, OpenTable
- Beauty: Fresha, StyleSeat, Bookwell

### Process Per Citation

1. Verify NAP matches `GBPLocation` exactly (see `google-business-profile` skill NAP protocol)
2. Use consistent description — first 250 characters identical across all citations
3. Upload the same logo/profile photo
4. Use UTM-tracked URL: `?utm_source=[directory]&utm_medium=citation&utm_campaign=local-seo`
5. Record submission date for quarterly audit

### Quarterly Citation Audit

- Re-check all citations for NAP accuracy
- Update any that have drifted (phone number changes, address changes)
- Add new directories where competitors appeared since last audit

## Local Link Acquisition Strategy

### Tier 1: High Authority, High Relevance

- Business associations and industry groups (e.g. Master Plumbers, HIA)
- Local chamber of commerce membership
- Local council business directories
- Professional body member pages

### Tier 2: Medium Authority, Local Relevance

- Local news sites (press releases for community involvement)
- Community event sponsorship (event pages link to sponsors)
- Local charity partnerships (charity pages link to supporters)
- Local business award submissions

### Tier 3: Lower Authority, Easy to Acquire

- Blogger partnerships (local lifestyle/area blogs)
- Supplier cross-links (if suppliers have a partner page)
- Local Facebook group features (with website link)
- Community forum contributions with profile link

### Assessment Criteria

For each opportunity, assess:

- **Domain authority** — higher is better, but local relevance matters more
- **Relevance** — is the linking site topically or geographically related?
- **Effort** — how much work to acquire? Balance against potential impact

## Review Generation Strategy

### Target

2-5 new genuine reviews per month per location.

### Ethical Tactics

1. **Post-service SMS/email** — include direct link to Google review page using `metadata.newReviewUri` from `GBPLocation`
2. **QR codes** — display in-store or on business cards linking to review page
3. **Staff training** — train front-line staff to ask satisfied customers for reviews
4. **Follow-up emails** — automated follow-up 24-48 hours after service completion

### Monitor Unreplied Reviews

```
useGBPReviews({ unreplied: true })
```

Every unreplied review is a missed opportunity. Target 100% response rate.

### Rules

- Never incentivise reviews with discounts or rewards (against Google policy)
- Never gate reviews (asking for rating first, then only directing positives to Google)
- Never post fake reviews or have staff write reviews
- Never ask customers to change or remove negative reviews

## Competitor Displacement Phases

### Phase 1: Audit (Weeks 1-4)

- Connect GSC + GBP for the client
- Add 3-5 competitors via `addCompetitor`
- Run `generateBenchmarkReport` for baseline
- Run citation gap analysis
- Identify top 10 content gaps

### Phase 2: Foundation (Weeks 5-8)

- Close citation gaps — submit to all directories where competitors are listed
- Match competitor review count — begin review generation campaign
- Fix all GBP listing issues from 12-point checklist
- Publish first 2-3 service-area pages targeting highest-volume local keywords

### Phase 3: Content Offensive (Weeks 9-12)

- Produce differentiated content on high-opportunity gaps
- Each piece: 10x depth, local angle, genuine E-E-A-T signals
- Cross-post via `content-pipeline` and `platform-content-adaptor`
- Begin local link acquisition (Tier 1 targets first)

### Phase 4: Maintain and Expand (Ongoing)

- Maintain review velocity (2-5/month)
- Publish 2-4 Google Posts per month
- Upload 2-3 fresh photos monthly
- Monitor `CompetitorAlert` for changes in competitive landscape
- Monthly audit cycle (see below)

## Monthly Audit Cadence

### Week 1: GSC Performance

- Pull 28-day GSC analytics via `fetchAnalytics`
- Compare against previous month and baseline
- Check `GSCSnapshot` trends for any regressions
- Identify new quick-win keywords (position 4-10, high impressions)
- Check for any Sentinel alerts

### Week 2: GBP Health

- Pull `GBPSnapshot` metrics via `useGBPInsights`
- Review response audit — any unreplied reviews? (`useGBPReviews({ unreplied: true })`)
- Check posting frequency — are we hitting 1-2 posts/week?
- Photo freshness — when was last upload?
- Verify listing details still accurate (hours, phone, categories)

### Week 3: Citation Audit

- Spot-check 5 citations for NAP consistency
- Any new directories to add?
- Any old listings with outdated information?
- Check competitor citation presence for new opportunities

### Week 4: Content and Competitive Review

- Run `identifyContentGaps` for updated gap analysis
- Review competitor activity from `CompetitorAlert` records
- Assess which content pieces performed best
- Plan next month's content calendar

### Monthly Report Card

Deliverable for each client:

| Section           | Data Source            | Key Metrics                                                              |
| ----------------- | ---------------------- | ------------------------------------------------------------------------ |
| Search visibility | GSCSnapshot            | Total clicks, impressions, avg position, top 10 queries                  |
| Local presence    | GBPSnapshot            | Search views, maps views, website clicks, phone clicks, direction clicks |
| Review health     | GBPReview              | Total reviews, avg rating, response rate, new reviews this month         |
| Keyword positions | GSC analytics by query | Position changes for target keywords                                     |
| Recommendations   | All skills combined    | Top 3 priority actions for next month                                    |

## Cross-References

| Skill                        | When to Invoke                                                                |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `google-search-console`      | Interpreting search analytics, diagnosing indexing issues, sitemap management |
| `google-business-profile`    | Listing optimisation, review management, Google Posts, insights analysis      |
| `google-updates-sentinel`    | Traffic drops, algorithm impact diagnosis, health score monitoring            |
| `competitive-local-strategy` | Competitor analysis, benchmarking, content gaps, displacement tactics         |
| `business-dna`               | Brand messaging consistency across all local content                          |
| `content-pipeline`           | AI content generation for service-area pages and blog posts                   |

> **Reference skill:** This is a read-only architecture guide — it documents existing systems and does not generate creative or code output. No capability uplift block is needed.
