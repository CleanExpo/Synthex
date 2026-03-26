---
name: google-business-profile
description: >-
  Listing optimisation, review response strategy, Google Posts, local pack
  ranking factors, NAP consistency, and category selection for Google Business
  Profile. Use when optimising GBP listings, managing reviews, or improving
  local search visibility.
metadata:
  author: synthex
  version: '1.0'
  engine: synthex-ai-agency
  type: reference-skill
  triggers:
    - google business
    - GBP
    - google maps
    - local listing
    - business reviews
    - google posts
    - local pack
    - NAP consistency
    - business categories
context: fork
---

# Google Business Profile — Listing Optimisation and Local Pack Strategy

## Purpose

SYNTHEX connects to Google Business Profile via OAuth to manage locations,
reviews, posts, insights, and photos. This skill documents how to optimise
GBP listings for maximum local search visibility and how to use Synthex
infrastructure to maintain listing health.

## Infrastructure Map

| Layer           | File                                                                          | Exports                                                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service         | `lib/google/business-profile.ts`                                              | `listLocations`, `getLocationDetails`, `updateLocation`, `getReviews`, `replyToReview`, `deleteReviewReply`, `createPost`, `listPosts`, `getInsights`, `listPhotos`, `getCategories`, `starRatingToNumber` |
| Auth            | `lib/google/google-auth.ts`                                                   | `getOAuthAccessToken`                                                                                                                                                                                      |
| Hook (SWR)      | `hooks/useGBPLocations.ts`                                                    | `useGBPLocations` — returns `locations`, `primaryLocation`, `syncLocations`, `refresh`                                                                                                                     |
| Hook (SWR)      | `hooks/useGBPReviews.ts`                                                      | `useGBPReviews({ locationId?, page?, limit?, rating?, unreplied? })` — returns `reviews`, `pagination`, `refresh`                                                                                          |
| Hook (SWR)      | `hooks/useGBPInsights.ts`                                                     | `useGBPInsights(locationId?, days?)` — returns `totals`, `totalReviews`, `averageRating`, `trend`                                                                                                          |
| Cron (5 AM UTC) | `app/api/cron/gbp-monitor/route.ts`                                           | Snapshots GBP metrics, fetches new reviews, generates AI reply suggestions (STORED only, NEVER auto-sent)                                                                                                  |
| Models          | Prisma: `GBPLocation`, `GBPReview` (with `aiSuggestion` field), `GBPSnapshot` | Per-org location records, review history, daily metric snapshots                                                                                                                                           |

**API Routes (8):**

| Route                                                | Method    | Purpose                           |
| ---------------------------------------------------- | --------- | --------------------------------- |
| `/api/google-business/locations`                     | GET       | List connected locations          |
| `/api/google-business/locations`                     | POST      | Sync locations from Google        |
| `/api/google-business/locations/[locationId]`        | GET/PATCH | Get or update a specific location |
| `/api/google-business/reviews`                       | GET       | List reviews (with filters)       |
| `/api/google-business/reviews/[reviewId]/reply`      | POST      | Send a reply to a review          |
| `/api/google-business/reviews/[reviewId]/auto-reply` | POST      | Generate AI reply suggestion      |
| `/api/google-business/posts`                         | GET/POST  | List or create Google Posts       |
| `/api/google-business/photos`                        | GET       | List location photos              |
| `/api/google-business/insights`                      | GET       | Get performance insights          |

## Listing Optimisation Checklist

Run through this 12-point checklist for every connected GBP location:

1. **Business name** — exact legal name, no keyword stuffing (Google will suspend for this)
2. **Primary category** — most specific match available; use `getCategories('query', 'AU')` to search
3. **Additional categories** — 3-5 categories covering secondary services (max 9 allowed)
4. **Address** — complete Australian format: "Suite X, 123 Street Name, Suburb STATE POSTCODE"
5. **Phone** — verified, local number preferred over 1300/1800 for local SEO
6. **Website** — HTTPS URL matching the business; tracked via `websiteUri` field
7. **Hours** — all 7 days set via `regularHours`; accurate and current
8. **Special hours** — public holidays and seasonal changes updated proactively
9. **Description** — 750 characters maximum; include primary services and location; natural language
10. **Services/menu items** — list all distinct services with descriptions
11. **Opening date** — set correctly; established businesses benefit from tenure signals
12. **Attributes** — gender-neutral restrooms, wheelchair accessible, etc. as applicable

## Review Response Strategy

### Timing Targets

| Rating    | Response Window | Priority                                |
| --------- | --------------- | --------------------------------------- |
| 1-2 stars | Within 24 hours | Critical — damage control               |
| 3 stars   | Within 48 hours | High — shows you care about improvement |
| 4-5 stars | Within 72 hours | Standard — builds relationship          |

### Tone Matrix

Matches the `gbp-monitor` cron's AI reply suggestion logic:

| Rating    | Tone                       | Approach                                                                    |
| --------- | -------------------------- | --------------------------------------------------------------------------- |
| 4-5 stars | Warm, grateful             | Thank specifically, mention what they enjoyed, invite return                |
| 3 stars   | Appreciative, constructive | Acknowledge feedback, mention specific improvements, offer to make it right |
| 1-2 stars | Empathetic, professional   | Apologise sincerely, take responsibility, offer offline resolution          |

### AI Reply Workflow

1. `gbp-monitor` cron fetches new reviews daily at 5 AM UTC
2. For unreplied reviews, AI generates a suggestion stored in `GBPReview.aiSuggestion`
3. Human reviews the suggestion in the dashboard
4. Approved replies are sent via `POST /api/google-business/reviews/[reviewId]/reply`

### Reply Rules

- Always use Australian English (colour, organise, recognise)
- Personalise every reply — reference specific details from the review
- Never use emojis in review replies
- Never include staff signatures or job titles
- Never be defensive or argumentative
- Never post identical replies to different reviews
- Keep replies concise: 2-4 sentences for positive, 3-5 sentences for negative

## Google Posts Strategy

### Post Types

| Type       | Expiry           | Best For                    |
| ---------- | ---------------- | --------------------------- |
| What's New | 7 days           | Regular updates, news, tips |
| Event      | After event date | Workshops, sales, open days |
| Offer      | After end date   | Promotions, discounts       |

### Publishing Guidelines

- Frequency: 1-2 posts per week (minimum to stay active in local pack)
- Length: 150-300 words with a clear value proposition
- Image: 400x300px minimum, JPEG format, relevant to content
- CTA options: Book, Order Online, Learn More, Sign Up, Call Now
- Created via `createPost(connectionId, locationName, post)` using the `GBPPost` interface

### Content Ideas for Local Businesses

- Behind-the-scenes of your service delivery
- Customer success stories (with permission)
- Seasonal tips related to your industry
- Staff introductions and expertise highlights
- Community involvement and local events
- New service or product announcements

## Local Pack Ranking Factors

### Relevance

How well your listing matches the search query:

- Primary and additional categories must accurately reflect services
- Description should contain natural service and location keywords
- Attributes and services list provide additional relevance signals

### Distance

How close your business is to the searcher:

- Address accuracy is critical — use exact coordinates
- Service-area configuration for businesses that travel to customers
- Geo-tagged photos strengthen location association

### Prominence

How well-known and trusted your business is:

- **Review quantity and quality** — more reviews with higher ratings
- **Review response rate** — 100% target; competitors average <50%
- **Citation consistency** — NAP identical across all directories
- **Website authority** — domain rating, backlinks, content quality
- **Behavioural signals** — tracked in `GBPSnapshot`: searchViews, mapsViews, websiteClicks, phoneClicks, directionClicks

## Category Selection Guide

```
Need to select categories?
  |
  +--> Search available categories
  |      getCategories('your service', 'AU')
  |
  +--> Select primary category
  |      Rule: most specific match to your core service
  |      "Plumber" not "Home Services"
  |      "Thai Restaurant" not "Restaurant"
  |
  +--> Select additional categories (3-5)
  |      Cover secondary services only
  |      Do not add aspirational categories
  |      Max 9 additional categories allowed
  |
  +--> Verify against competitors
         Check what categories top-ranking local competitors use
         Missing a common category = missed relevance signal
```

## NAP Consistency Protocol

NAP = Name, Address, Phone. Must be identical across all online presence.

### Source of Truth

`GBPLocation.address` is the canonical NAP record. All citations must match exactly.

### Australian Address Format

```
[Business Name]
[Suite/Unit X, ]123 Street Name
Suburb STATE POSTCODE
Australia

Phone: (0X) XXXX XXXX or 04XX XXX XXX
```

### Where to Enforce NAP

1. Google Business Profile (primary)
2. Business website (header/footer + contact page)
3. All directory citations (Yellow Pages AU, True Local, Hotfrog, etc.)
4. Social media profiles
5. Schema markup on website (LocalBusiness structured data)

### Common NAP Inconsistencies to Audit

- "St" vs "Street", "Rd" vs "Road"
- Old phone numbers on legacy listings
- Abbreviated vs full suburb/state names
- Missing suite/unit numbers
- Different trading name vs legal entity name

## Photo Optimisation

### Minimum Photo Set

| Type              | Count | Purpose                                  |
| ----------------- | ----- | ---------------------------------------- |
| Logo              | 1     | Brand recognition in search              |
| Cover             | 1     | First impression in listing              |
| Interior          | 3+    | Show the space customers will experience |
| Exterior          | 3+    | Help customers find the location         |
| Team              | 3+    | Build trust and personal connection      |
| Products/Services | 3+    | Showcase what you offer                  |

### Photo Requirements

- Minimum 720px on the longest edge
- JPEG format preferred (smaller file size than PNG)
- Geotag photos with business coordinates
- Upload 2-3 fresh photos monthly to signal an active listing
- Use `listPhotos(connectionId, locationName)` to audit current photo inventory

## Insights Interpretation

`useGBPInsights(locationId, days)` returns totals and 30-day trend data.

### Key Metrics

| Metric          | What It Measures            | Good Benchmark                                 |
| --------------- | --------------------------- | ---------------------------------------------- |
| searchViews     | Discovery via Google Search | Trending up month-over-month                   |
| mapsViews       | Discovery via Google Maps   | Higher than searchViews for local businesses   |
| websiteClicks   | Click-throughs to website   | >5% of total views for service businesses      |
| phoneClicks     | Direct phone calls          | Conversion signal — track against revenue      |
| directionClicks | Navigation requests         | Strongest intent signal for physical locations |

### Conversion Rate Formula

```
Conversion Rate = (websiteClicks + phoneClicks + directionClicks) / (searchViews + mapsViews) * 100

Target: >5% for service businesses, >8% for retail/hospitality
```

### Trend Analysis

Use the `trend` array from `useGBPInsights` to plot 30-day performance.
Correlate changes with:

- Review response activity
- Google Posts publishing frequency
- Photo uploads
- Category or description changes
- Algorithm updates (cross-reference with `google-updates-sentinel` skill)

> **Reference skill:** This is a read-only architecture guide — it documents existing systems and does not generate creative or code output. No capability uplift block is needed.
