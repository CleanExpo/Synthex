# Synthex Product Roadmap — 2026

## Vision

AI that makes every local business visible everywhere customers search — social media, Google Maps, and AI search — from one dashboard, for less than the cost of a single social media post. Synthex exists so that a plumber in Penrith, a café in Carlton, or a physio clinic in Fortitude Valley can compete for attention in every channel their customers use — without hiring an agency, learning new software, or spending more than 10 minutes a week.

---

## Strategic Bets

These are the three product bets Synthex is making in 2026. Each bet is backed by research and creates a compounding advantage.

**Bet 1 — The local service vertical is unclaimed and worth $294M AUD TAM in Australia**

The 2.66M small businesses in Australia represent an addressable market that every global social media tool has treated as an afterthought. At $49/month × 5% penetration, that is $78.5M ARR. The trades category alone (462,939 businesses) has zero funded AI social media competitors. Zoca raised $6M from Accel for the beauty/wellness vertical — proof that vertical-specific social AI is a fundable and defensible category. Synthex targets five verticals where purpose-built tools do not exist.

**Bet 2 — GBP + social + AI search is an unclaimed convergence no competitor is building**

Google Business Profile posts drive 520% more calls for businesses with active content. AI Overviews now trigger in 68% of local search queries. AI referral traffic converts at 14.2% versus Google organic's 2.8% — five times better. Today, no social media scheduling tool treats GBP as a first-class platform, and no tool optimises posts for AI search visibility. This gap is the product surface Synthex owns exclusively in 2026.

**Bet 3 — Voice authenticity at the $49/month price point is the product moat**

The single largest churn risk in AI content tools is generic output. When a post sounds like it was written by software, the trial ends. Voice authenticity — capturing the specific tone, language, and personality of each individual business — is the technical and UX investment that retains customers past the first post. Combined with a price point accessible to sole traders and micro-businesses, this creates a moat that enterprise tools cannot easily replicate downmarket.

---

## Milestone 1 — Voice & Vertical Foundation (Q2 2026)

**Goal:** First-session voice capture and industry-specific content. Every new user has posts drafted in their authentic voice within 10 minutes of signup.

**Why this first:** The primary product risk is that AI content sounds generic and every free trial ends at the first post. The product must deliver visible, personalised value before the user leaves the onboarding screen. The "broken trust" customer — someone who tried posting before, got nothing back, and abandoned it — is the dominant persona. The first session must prove the product works.

### Features

**Voice Onboarding Flow**
A five-question onboarding that captures business type, tone, target customer, typical job or service, and one thing that makes the business different. The AI processes answers immediately and generates the first week of posts before the user reaches the dashboard. No blank canvas. No "get started" prompts. Content is waiting for them.

Questions:

1. What does your business do? (type + service area)
2. Who is your typical customer?
3. How would your best customer describe you in one sentence?
4. What is something you are proud of that most businesses in your industry do not do?
5. What tone fits your brand? (options: professional, friendly, casual, direct, warm)

**Industry Modes**
Six pre-built content modes, each with scenario-specific templates:

| Industry                                      | Key Scenarios                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Trades (plumbing, electrical, HVAC, building) | Just completed a job, before/after, quote tip, safety reminder, meet the team                     |
| Café & Restaurant                             | Daily specials, new menu item, behind the scenes, customer shoutout, hours update                 |
| Salon & Beauty                                | Before/after, booking availability, product highlight, team introduction, seasonal look           |
| Gym & Fitness                                 | Member milestone, class spotlight, coach introduction, challenge announcement, result story       |
| Clinic (physio, chiro, dental)                | Patient education, service spotlight, team profile, seasonal health tip, appointment availability |
| Restaurant                                    | Dish of the day, chef spotlight, event night, local ingredient story, table availability          |

Each mode has a minimum of 20 pre-built prompt structures that work without additional input from the user.

**Engagement Prediction Score**
Every generated post receives a 0–100 engagement score before publishing, with one specific, actionable suggestion. The score is based on: post length for the platform, presence of a call to action, use of local keywords, image recommendation, and posting time optimisation. The score creates a daily habit loop — a reason to return every time they post.

Score breakdown:

- 0–39: Needs improvement (suggestion mandatory)
- 40–69: Good (suggestion shown)
- 70–100: Strong (suggestion optional)

**Success metric:** Percentage of trials that produce at least one published post in session one.

**Target:** 60% of new trials publish in session one by end of Q2 2026.

---

## Milestone 2 — Google Business Profile Native (Q3 2026)

**Goal:** GBP as a first-class posting destination. Synthex is the only social media tool that treats Google Maps as a platform, not an afterthought.

**Why this matters:** GBP posts drive 520% more calls for active businesses. No social scheduling competitor — Buffer, Hootsuite, FeedHive, Zoca — offers native GBP posting. This is a clear, uncontested product surface available to Synthex today.

### Features

**GBP Connect**
OAuth connection to Google Business Profile using the same connection flow as Instagram and Facebook. Single screen, business selection, permission grant, connected. GBP appears in the platform selector alongside Instagram, Facebook, LinkedIn, and TikTok.

Technical requirements:

- Google Business Profile API v4
- OAuth 2.0 with offline access
- Support for multi-location businesses (select one or all locations)
- Post types: What's New, Event, Offer, Product update

**GBP Post Templates**
Auto-generated post content mapped to GBP post types:

- Weekly update (What's New): general business activity, services, team content
- Event/promotion (Event, Offer): seasonal promotions, special events, limited offers
- Seasonal: holiday trading hours, seasonal service reminders
- "We're open": confirmation of hours, location, contact — optimised for "near me" searches

All templates pull from the business brief set during onboarding. No additional input needed.

**Cross-Post Mode**
One content brief → three platform-adapted outputs in one action:

1. GBP post (160 characters, CTA with phone or directions link)
2. Instagram caption (with hashtag set, 2,200 character limit used appropriately)
3. Facebook post (conversational, link-friendly, 500–800 characters)

The user writes or approves one version; Synthex adapts it for each platform's format, character limits, link behaviour, and audience expectations.

**NAP Checker**
On connection of any new platform, Synthex checks business name, address, and phone number across all connected accounts and flags inconsistencies. NAP consistency is a primary local SEO ranking factor. Mismatches are surfaced as an action item in the dashboard with suggested corrections.

**Success metric:** Percentage of active users who have GBP connected.

**Target:** 40% of active paying users have GBP connected by end of Q3 2026.

---

## Milestone 3 — AI Search Visibility (Q4 2026)

**Goal:** "Post to social. Rank in Maps." Every post becomes a local search optimisation event.

**Why this matters:** AI Overviews trigger in 68% of local search queries. Only 1.2% of local businesses are recommended by AI search engines. AI referral traffic converts at 14.2% versus organic's 2.8%. No social media tool currently optimises for AI search visibility. This is a distinct product surface with a clear, communicable customer benefit.

### Features

**Local SEO Mode**
A toggle in the post composer. When enabled, the AI enriches every generated caption with:

- Suburb or city keyword (pulled from business address)
- Primary service keyword (from business type and onboarding answers)
- Opening hours mention where relevant
- Location-specific call to action ("Call us in [suburb]", "Book online — serving [area]")
- Schema-aware language patterns that match how AI search engines summarise local businesses

Local SEO Mode is available on all post types and all connected platforms. It does not alter the voice or tone captured during onboarding — it adds structured information the AI uses for ranking signals.

**AI Visibility Score**
A dashboard widget showing four signals with improvement actions:

| Signal                        | What it measures                                            | Improvement action              |
| ----------------------------- | ----------------------------------------------------------- | ------------------------------- |
| GBP completeness              | % of GBP fields filled                                      | Lists missing fields            |
| Review velocity               | Reviews received in last 30 days                            | Prompts review request campaign |
| Citation coverage             | Presence on Apple Maps, Bing, Yelp, Yellow Pages AU         | Links to missing listings       |
| AI search visibility estimate | Estimated % of local AI queries where business could appear | Post frequency recommendation   |

The score is a 0–100 composite. The primary message is the delta: "You are visible to an estimated 2% of AI search queries. Here's what moves the number."

**Schema Markup Generator**
LocalBusiness JSON-LD output generated from account data. The user copies one code block and pastes it into their website header (or sends it to their web developer). Synthex populates:

- Business name, address, phone, website
- Opening hours (if provided)
- Service area (suburb and city)
- Business category
- Social profile links (all connected platforms)
- Average rating and review count (from connected GBP)

Updated automatically when account data changes. Re-generated on demand from the settings panel.

**"Near Me" Content Templates**
Pre-built post structures engineered to trigger local intent signals in AI and search algorithms:

- "The best [service] in [suburb]" — first-person recommendation format
- Opening hours posts — structured for AI parsing ("We're open [hours] — find us at [address]")
- Service area announcements — lists suburbs served
- "Before you call anyone else" format — establishes authority for a specific service in a specific location

These are available in the Industry Mode template library under a "Local Search" tag.

**Success metric:** Number of businesses using Local SEO Mode.

**Target:** 35% of active users have Local SEO Mode enabled by end of Q4 2026.

---

## Milestone 4 — Mobile-First & Autopilot (Q1 2027)

**Goal:** Post from the job site. The tradie workflow: photo → tap → done in 60 seconds.

**Why this matters:** The primary persona for the trades vertical uses a phone, not a laptop. They are between jobs, not at a desk. The scheduling tools built for marketing managers fail entirely for this user. The mobile-first composer is the product surface that unlocks the single largest vertical in the Australian market.

### Features

**Mobile Composer**
Streamlined mobile interface:

1. Tap the camera icon
2. Take or select a photo
3. AI detects job type from image (optional, can be overridden)
4. Three caption options generated in five seconds
5. Select one, tap post, done

Target: under 60 seconds from photo to scheduled post. Designed for phone-only users with no assumption of desktop access.

Additional mobile composer features:

- Voice-to-text caption override
- Quick platform selection (most-used platforms shown first)
- One-tap scheduling to next optimal time slot

**Autopilot Mode**
Connect a business, set posting frequency (1×/week, 3×/week, 5×/week), and Synthex runs without further input. Uses the industry-specific content calendar, sources content from the post template library, posts at AI-optimised times, and rotates content types to maintain variety.

Autopilot Mode is the retention mechanism for the "I know I should post but I never do" customer. When active, the product delivers value regardless of user engagement.

Configuration options:

- Posting frequency per platform
- Content type mix (educational, promotional, behind the scenes, social proof)
- Blackout periods (no posts during specified times)
- Review and approve before posting (optional — default is fully automatic)

**UGC Collection**
Post-interaction workflow that turns customer engagement into scheduled content:

- Automated prompt to customers via email or SMS after a job or visit: "Got a photo to share? Tag us or reply here."
- Tagged content collected in the Synthex media library
- One-tap approval to turn customer photos into a scheduled post with an AI-generated caption

**Review Response Drafting**
When a new Google or Facebook review is received:

- AI generates a draft response
- Draft is sent to the owner for one-tap approval or edit
- Published immediately on approval
- Maintains the business's voice and tone profile

Response types handled:

- 5-star positive review
- 4-star with no text
- 3-star with constructive feedback
- Negative review with complaint (flags for human attention, drafts a calm acknowledgement)

**Success metric:** Percentage of users on autopilot — defined as no manual post creation in 30 days.

**Target:** 25% of active users on autopilot by end of Q1 2027.

---

## Milestone 5 — Agency & White-Label (Q2 2027)

**Goal:** B2B2C distribution layer. Agencies managing local business social media can use Synthex as their backend at $150–$300/month for 10–20 client accounts.

**Why this matters:** Digital marketing agencies and freelancers managing multiple local business accounts are a high-value acquisition channel. Each agency account represents 5–20 end business customers. The agency tier also dramatically reduces CAC — one B2B sale replaces 10–20 individual B2C sales cycles.

### Features

**Agency Dashboard**
Multi-account management interface:

- All client accounts visible from one login
- Per-client voice profiles (each client has a separate onboarding brief)
- Bulk scheduling across all accounts
- Content approval workflow (agency drafts, client approves via email link)
- Client activity summary (last post date, next scheduled posts, platforms connected)

**White-Label Option**
Agency branding applied to the client-facing interface:

- Agency logo, colour scheme, and domain
- Client sees "[Agency Name] Social" — not Synthex
- Branded email notifications and reports
- Available at the top agency tier

**Client Reporting**
Monthly report card per client focused on business outcomes, not platform metrics:

| Outcome metric                      | Source           |
| ----------------------------------- | ---------------- |
| Estimated enquiries from GBP        | GBP Insights API |
| Profile views (GBP + social)        | Platform APIs    |
| Post reach and engagement           | Platform APIs    |
| Review count change                 | GBP API          |
| AI visibility score change          | Synthex internal |
| Posts published (planned vs actual) | Synthex internal |

Reports are automated, branded to the agency, and sent to clients monthly. Agencies use them as a retention tool for their own clients.

**Success metric:** Percentage of ARR from agency tier.

**Target:** 15% of ARR from agency accounts by end of Q2 2027.

---

## Competitive Moat Summary

| Feature                                    | Buffer     | Hootsuite | FeedHive | Zoca        | **Synthex** |
| ------------------------------------------ | ---------- | --------- | -------- | ----------- | ----------- |
| AI content generation                      | Basic      | Yes       | Yes      | Yes         | **Yes**     |
| Voice training per business                | No         | No        | Partial  | Partial     | **Yes**     |
| Google Business Profile native             | No         | No        | No       | No          | **Yes**     |
| Industry-specific templates (5+ verticals) | No         | No        | No       | Beauty only | **Yes**     |
| AI search visibility optimisation          | No         | No        | No       | No          | **Yes**     |
| Local SEO mode in post composer            | No         | No        | No       | No          | **Yes**     |
| Schema markup generator                    | No         | No        | No       | No          | **Yes**     |
| Mobile-first job-site flow                 | No         | No        | No       | No          | **Yes**     |
| Autopilot (zero-touch posting)             | No         | No        | Partial  | No          | **Yes**     |
| Review response drafting                   | No         | No        | No       | No          | **Yes**     |
| AU local business focus                    | No         | No        | No       | No          | **Yes**     |
| Agency / white-label tier                  | Yes        | Yes       | No       | No          | **Yes**     |
| Price (monthly, solo tier)                 | $6/channel | $199+     | $19–49   | ~$80+       | **$49**     |

---

## Australian GTM Priority Verticals

Ordered by opportunity score (market size × competition gap × posting frequency × social proof sensitivity):

**1. Trades — Plumbing, Electrical, HVAC, Building**

- 462,939 businesses in Australia
- Zero funded AI social competitors in this vertical
- Primary posting triggers: job completion, before/after, safety tips
- Key platform: Facebook + GBP (homeowner research channel)
- Acquisition channel: tradie Facebook groups, Master Plumbers AU, HIA, NECA

**2. Café & Restaurant**

- 80,000–100,000 businesses in Australia
- High posting frequency (daily specials, events)
- Strong Instagram and Facebook usage already established
- Churn risk is low when daily specials template is active — content never runs dry
- Acquisition channel: Hospitality Association of Australia, Square POS partnership

**3. Salon & Beauty**

- 60,000–80,000 businesses in Australia
- Highly visual content — strong before/after format
- Operators are socially aware and already posting inconsistently
- Zoca validation confirms this vertical pays for social AI
- Acquisition channel: HBIA, Timely/Kitomba booking software partnership

**4. Gym & Fitness**

- 25,000–40,000 businesses in Australia
- Strong community identity — member milestone and challenge content performs well
- High average revenue per member makes $49/month easy to justify
- Acquisition channel: Fitness Australia, Mindbody/Glofox partnership

**5. Health Clinics — Physio, Chiro, Dental**

- 18,000–30,000 businesses in Australia
- Compliance-sensitive: content must avoid therapeutic claims
- High trust requirement — voice authenticity is critical
- Underserved by generic AI tools that cannot navigate compliance nuance
- Acquisition channel: Australian Physiotherapy Association, Dental industry conferences

---

## The Killer Landing Page Stat

> "AI search recommends only 1.2% of local businesses. The other 98.8% are invisible. Synthex fixes that."

---

## Key Milestones Timeline

| Quarter | Milestone                      | Primary outcome                      |
| ------- | ------------------------------ | ------------------------------------ |
| Q2 2026 | Voice & Vertical Foundation    | 60% of trials publish in session one |
| Q3 2026 | Google Business Profile Native | 40% of users have GBP connected      |
| Q4 2026 | AI Search Visibility           | 35% of users using Local SEO Mode    |
| Q1 2027 | Mobile-First & Autopilot       | 25% of users on autopilot            |
| Q2 2027 | Agency & White-Label           | 15% of ARR from agency tier          |

---

## Revenue Model

| Tier   | Price (AUD/month) | Target customer                 | Included                                                       |
| ------ | ----------------- | ------------------------------- | -------------------------------------------------------------- |
| Solo   | $49               | Single location, sole trader    | 3 platforms, 30 posts/month, GBP, AI Visibility Score          |
| Growth | $99               | Small team, 1–2 locations       | 6 platforms, unlimited posts, Local SEO Mode, review responses |
| Agency | $199–$299         | Marketing agency, 10–20 clients | Multi-account, white-label, client reporting, bulk scheduling  |

**TAM calculation (Australia):**

- Total AU small businesses: 2.66M
- Serviceable addressable market (5 target verticals): ~765,000 businesses
- 5% penetration at blended ARPU $65/month = $29.8M AUD ARR
- 10% penetration = $59.7M AUD ARR
- Global English-speaking expansion (UK, NZ, Canada) multiplies TAM 8–12×

---

## Research Provenance

This roadmap is derived from research across five specialist analysis domains:

1. **Competitor intelligence** — Buffer, Hootsuite, FeedHive, Later, Zoca, ManyChat, Metricool, Radaar feature and pricing analysis
2. **Platform trend analysis** — GBP API capabilities, AI Overviews penetration data, TikTok/Instagram/Facebook algorithm priorities for local content
3. **Local business pain point research** — tradie and small business owner interviews, AU government small business digital adoption data, Xero/MYOB SMB report findings
4. **AI tools market gap analysis** — ProductHunt, AppSumo, G2 review pattern analysis for AI social tools, funding announcements in vertical SaaS
5. **AEO/GEO/local SEO opportunity** — AI Overview trigger rate research, AI referral conversion benchmarks, local business citation and GBP completeness data

All data points cited in this document are sourced from public research available as of Q1 2026 and should be revalidated at each milestone review.

---

_Last updated: 17/03/2026_
_Owner: Product_
_Status: Approved for execution_
