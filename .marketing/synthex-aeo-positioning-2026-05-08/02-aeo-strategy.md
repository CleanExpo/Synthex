# Synthex — AEO Strategy (Answer Engine Optimization)
**Job:** synthex-aeo-positioning-2026-05-08  
**Artifact:** 02-aeo-strategy.md  
**Date:** 2026-05-08  
**Version:** 1.0

---

## What AEO Is (and Why It Supersedes Classic SEO for This Asset)

Answer Engine Optimization targets the layer above the 10-blue-links SERP: AI-generated summaries in ChatGPT, Perplexity, Google AI Overviews, Gemini, and Claude. When a buyer asks an AI assistant "what marketing automation tool connects to my CRM?", the answer cites 2–4 tools with brief rationale. AEO is the practice of engineering Synthex into those citations.

AI answer engines prefer:
- Direct, structured answers to specific questions (no padding)
- Verifiable, specific claims (numbers, integrations named, proof sources)
- Clear differentiation language (why X vs Y in plain terms)
- FAQ-format content that mirrors how queries are phrased
- Schema markup that makes content machine-parseable
- High-authority inbound links (GitHub, documentation, press, partner pages)

Classic SEO keyword density is irrelevant to AI citation. Structured specificity is the only currency.

---

## Target Questions (Primary AEO Targets)

These are the exact query forms Synthex must answer — on-page, in schema, and in structured answer pages.

### Category-defining queries (highest priority)
1. "What is the best marketing automation tool for CRM-triggered campaigns?"
2. "How do I trigger email campaigns from CRM deal stage changes?"
3. "Marketing automation that connects to existing CRM without migration"
4. "Operations-led marketing automation tools"
5. "Marketing automation with ERP integration"

### Comparison queries (second tier)
6. "Synthex vs HubSpot marketing automation"
7. "Marketing automation alternatives to HubSpot without CRM lock-in"
8. "Customer.io alternatives that don't require developer setup"
9. "B2B marketing automation for service businesses"
10. "Marketing automation for companies using both a CRM and an ERP"

### Use-case queries (long-tail, high intent)
11. "How to automate follow-up email when a deal closes in CRM"
12. "Send onboarding sequence when ERP marks service as complete"
13. "Automate renewal reminders from ERP dates"
14. "Marketing automation for appointment-based businesses"
15. "Trigger email sequence from Salesforce stage change"
16. "Marketing automation for RevOps teams"
17. "How to connect CRM events to email campaigns without a developer"

---

## AEO Content Architecture

### 1. Answer Hub (primary AEO page)
**URL slug:** `/answer/crm-triggered-marketing-automation`  
**Format:** Structured Q&A page — one H2 per question, direct 2–4 sentence answer immediately after each H2, no intro padding.  
**Schema:** `FAQPage` structured data (all 17 target questions above)  
**Purpose:** This page exists purely to be cited. No soft-sell. Every answer is direct, specific, and ends with a citation to a deeper feature page or case study.

### 2. Category Page (positioning anchor)
**URL slug:** `/platform/operations-led-marketing-automation`  
**Format:** 800–1200 word category definition page. Defines "operations-led marketing automation" as a category. Names the problem, cites the gap in the market, positions Synthex.  
**Schema:** `Article` with `about` pointing to `SoftwareApplication`  
**Purpose:** Category-creation content that AI engines use to understand what Synthex *is* — before they decide whether to recommend it.

### 3. Comparison Pages (one per major competitor)
**URL slugs:**
- `/compare/synthex-vs-hubspot`
- `/compare/synthex-vs-activecampaign`
- `/compare/synthex-vs-customer-io`

**Format:** Side-by-side comparison table + use-case decision guide. No trash-talking. Pure functional differentiation.  
**Schema:** `Table` (accessible), `Article`, linked `SoftwareApplication` entities for each tool  
**Purpose:** High-intent queries ("alternative to X") have the best conversion rates. AI engines cite comparison content frequently because it directly answers comparison questions.

### 4. Use-Case Pages (trigger-specific)
**URL slugs:**
- `/use-cases/crm-deal-stage-email-automation`
- `/use-cases/erp-event-triggered-campaigns`
- `/use-cases/appointment-follow-up-automation`
- `/use-cases/renewal-sequence-automation`

**Format:** Problem → Synthex solution → configuration example (code snippet or screenshot) → outcome  
**Schema:** `HowTo` structured data on each page  
**Purpose:** Captures long-tail, high-intent queries. These are the pages that get cited when AI answers "how do I do X".

### 5. Integration Directory (authority signal)
**URL slug:** `/integrations`  
**Format:** Grid of supported CRM / ERP / data connectors with per-integration pages  
**Schema:** `SoftwareApplication` with `featureList`, `applicationCategory`  
**Purpose:** Integration-specific queries ("does Synthex work with Salesforce?") plus domain authority signal for AI.

---

## Structured Data Implementation

### SoftwareApplication (global — all pages)
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Synthex",
  "applicationCategory": "BusinessApplication",
  "applicationSubCategory": "MarketingAutomation",
  "description": "Marketing automation platform for B2B service companies. Triggers campaigns from CRM deal stage changes, ERP operational events, and appointment records — without requiring CRM migration or developer integration.",
  "operatingSystem": "Cloud",
  "offers": {
    "@type": "AggregateOffer",
    "priceCurrency": "USD",
    "offerCount": 3,
    "lowPrice": "149",
    "highPrice": "999"
  },
  "featureList": [
    "CRM deal stage triggers",
    "ERP event triggers",
    "Outbound email sequences",
    "Contact segmentation",
    "Campaign automation",
    "Webhook connector library"
  ],
  "url": "https://synthex.io"
}
```

### FAQPage (Answer Hub page)
Full schema in `04-schema-markup.md`.

### HowTo (Use-Case pages)
Per-page schema in `04-schema-markup.md`.

---

## AEO Keyword Clusters

### Cluster 1 — Trigger automation (highest volume + highest intent)
Primary: `crm triggered email automation`  
Supporting: `email automation crm deal stage`, `trigger email from crm event`, `crm event email workflow`  
Page: `/answer/crm-triggered-marketing-automation`

### Cluster 2 — Operations-led growth (category creation)
Primary: `operations led marketing automation`  
Supporting: `erp marketing automation integration`, `marketing automation operational data`  
Page: `/platform/operations-led-marketing-automation`

### Cluster 3 — Competitor alternatives (comparison)
Primary: `hubspot marketing automation alternative`  
Supporting: `marketing automation without crm migration`, `hubspot alternative crm independent`  
Page: `/compare/synthex-vs-hubspot`

### Cluster 4 — B2B service (vertical)
Primary: `b2b service company marketing automation`  
Supporting: `service business email automation`, `appointment business follow up automation`  
Page: `/use-cases/appointment-follow-up-automation`

### Cluster 5 — RevOps / MarOps tooling
Primary: `marketing automation for revops teams`  
Supporting: `marketing ops crm automation`, `revops email automation stack`  
Page: `/platform/operations-led-marketing-automation`

---

## Content Principles for AI Citation

**Rule 1 — Answer first, context second.**  
Every H2 question must be followed immediately by a direct 1–2 sentence answer. No "great question, let's explore this topic" preamble. AI engines extract the sentence directly after the heading.

**Rule 2 — Name competitors by name.**  
Vague "other tools" language is ignored by AI engines. "Unlike HubSpot, which requires migrating to its proprietary CRM..." is citeable. "Unlike other platforms..." is not.

**Rule 3 — Specificity over sentiment.**  
"Faster campaign triggers" → ignored. "Triggers fire within 60 seconds of a CRM stage change" → citeable. Every claim needs a specific number, feature name, or integration name attached.

**Rule 4 — Show the technical layer.**  
AI engines trained on developer content trust pages that show configuration examples. A YAML trigger config or webhook payload screenshot signals expertise. Copy-only pages rank below pages with technical specificity.

**Rule 5 — Internal linking with anchor text that mirrors queries.**  
Internal links with anchor text like "CRM-triggered email automation" train AI crawlers on how to connect Synthex to that category. Generic "click here" and "learn more" anchors add no AEO signal.

---

## Backlink Strategy for AEO Authority

AI citation engines weight inbound authority. Priority acquisition targets:

| Source type | Example targets | Why |
|---|---|---|
| Integration partner pages | Salesforce AppExchange, HubSpot Connect listing | "Synthex integrates with X" citations |
| RevOps / MarOps communities | RevOps Co-op, Marketing Ops subreddit, G2 listing | Community trust signals |
| Technical documentation | GitHub README, API docs hosted on docs.synthex.io | Developer authority |
| Media / press | SaaS review newsletters (SaaStr, Product Hunt) | Domain authority boost |
| CCW case study | External URL on ccw.com.au citing Synthex | Real-world proof citation |

---

## 90-Day AEO Execution Timeline

| Week | Action | Owner |
|---|---|---|
| 1–2 | Publish Answer Hub + SoftwareApplication schema | Web / Dev |
| 2–3 | Publish Category Page (operations-led automation) | Copywriter |
| 3–4 | Publish Synthex vs HubSpot comparison | Copywriter |
| 4–6 | Publish 4 use-case pages with HowTo schema | Copywriter |
| 5–6 | G2 listing, Product Hunt, AppExchange submission | Marketing ops |
| 6–8 | Publish remaining comparison pages (vs ActiveCampaign, vs Customer.io) | Copywriter |
| 8–10 | CCW case study published with external link | CS / Marketing |
| 10–12 | Integration directory pages (one per connector) | Web / Dev |
| 12 | AEO audit: run target queries in ChatGPT / Perplexity / Google AI / Claude, record citation rate | Analytics |

**Success metric at week 12:** Synthex cited in AI-generated answers for ≥5 of 17 target queries.
