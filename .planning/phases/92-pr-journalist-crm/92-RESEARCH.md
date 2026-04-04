# Phase 92: Journalist & PR Relationship Manager — Research

**Researched:** 2026-03-11
**Domain:** PR CRM, journalist discovery, pitch tracking, coverage monitoring, press release AI indexing
**Confidence:** HIGH

<research_summary>

## Summary

Phase 92 builds a **Journalist & PR Relationship Manager** — a CRM layer on top of Synthex that lets users discover journalists by beat, track pitch outreach through a defined lifecycle, monitor editorial coverage of their brand, and publish press releases structured for AI engine indexing. The goal is zero paid SaaS dependency (no Muck Rack, no Cision, no Medianet subscription).

### What to Build

Three interconnected domains:

1. **Journalist CRM** — A `JournalistContact` record store. Users manually add contacts enriched via free APIs (Hunter.io for email verification, NewsData.io / GDELT / Perigon free tier for recent bylines and beat inference). Contacts carry beat tags, outlet, recent coverage URLs, and relationship notes. Beat classification is LLM-assisted: fetch the journalist's last 5 articles from a news API, send titles + descriptions to the OpenRouter model, receive a structured beat list back.

2. **Pitch Tracker** — A `PRPitch` model capturing the full outreach lifecycle: `draft → sent → opened → replied → covered → archived`. Each pitch links to one journalist, one optional campaign, and an AI-generated subject/body. The pitch record stores email subject, angle, personalisation note, sent timestamp, and follow-up schedule. Coverage discovered via the existing Phase 91 mention-poller is auto-linked when a `MediaCoverage` URL matches a pitched journalist's outlet domain.

3. **Coverage Monitor + Press Release Publisher** — Reuses `lib/brand/mention-poller.ts` (GDELT + NewsData.io) for brand-in-editorial monitoring. Adds a lightweight `MediaCoverage` record distinct from `BrandMention` — because editorial coverage from a pitched journalist has extra metadata (outlet tier, journalist link, pitch-attribution). Press releases are stored as structured content with `schema.org/PressRelease` JSON-LD and published to a public `/pr/[slug]` newsroom route for AI engine indexing.

### Key Decision: Free APIs That Work

| Need | Free Solution | Why It Works |
|------|--------------|--------------|
| Journalist beat research | GDELT Doc API (unlimited) + NewsData.io free (200 req/day) | Fetch recent articles by outlet; infer beat from titles via OpenRouter |
| Email discovery | Hunter.io free tier (50 credits/month) | REST API, no npm package needed — native `fetch()` to `api.hunter.io` |
| Coverage monitoring | Reuse `lib/brand/mention-poller.ts` unchanged | Already queries GDELT + NewsData.io; extend with outlet domain filter |
| Australian journalists | Manual entry + Qwoted free web database (manual copy) | Telum Media / Medianet have no free API — users export CSV, import to CRM |
| Press release indexing | Self-hosted newsroom page with `NewsArticle` + `PressRelease` JSON-LD | Schema markup is the mechanism; no distribution wire needed for AI indexing |

### What to Skip

- **Perigon journalist API** — Journalist endpoint only available on $550/mo Plus plan. Free tier (150 req/month) gives articles only, not the journalist database.
- **LinkedIn scraping** — ToS violation, legal risk, unreliable.
- **Twitter/X API** — Free tier is too restricted (500 tweets/month read) to be useful for beat analysis.
- **Telum Media / Medianet / Mediaconnect** — Australia-specific, paid-only, no public API.
- **Qwoted API** — No public API; free web database is manual-use only.
- **HARO (now Connectively)** — Inbound model only; we are tracking outbound pitches.

</research_summary>

<standard_stack>

## Standard Stack

### Core Infrastructure (No New Packages)

| Approach | Purpose | Why |
|----------|---------|-----|
| Prisma 6 (extend schema) | `JournalistContact`, `PRPitch`, `MediaCoverage`, `PressRelease` models | Consistent with all other Phase data models |
| Native `fetch()` in API routes | Hunter.io email finder, NewsData.io, GDELT beat research | Server-side only; follows existing `mention-poller.ts` pattern |
| Reuse `lib/brand/mention-poller.ts` | Coverage monitoring (unchanged) | Phase 91 already validated this — GDELT + NewsData.io dedup chain |
| Reuse `lib/brand/mention-deduplicator.ts` | URL-normalised deduplication of coverage results | Same logic applies to editorial mentions |
| OpenRouter (existing `lib/ai/`) | Beat classification from article titles, pitch draft generation | Already integrated; no new package |
| SWR (existing pattern) | Client-side journalist list, pitch board, coverage feed | Follows `GamificationWidget.tsx` pattern |
| Radix UI + Tailwind | All UI components (pitch kanban, journalist profile, coverage table) | Project standard |

### API Reference Table

| API | Free Limit | Use Case | Auth | Implementation |
|-----|-----------|----------|------|----------------|
| GDELT Doc API v2 | Unlimited, no auth | Beat research (recent articles by outlet), coverage monitoring | None | `fetch()` to `api.gdeltproject.org/api/v2/doc/doc` |
| NewsData.io | 200 req/day, 10 results/req | Brand mention monitoring (reused from Phase 91) | `NEWSDATA_API_KEY` env var | Already in `mention-poller.ts` |
| Hunter.io Email Finder | 50 credits/month free | Verify / discover journalist email from name + domain | `HUNTER_API_KEY` env var | `GET https://api.hunter.io/v2/email-finder` |
| Hunter.io Domain Search | 25 credits/month free | Find all journalists at a specific outlet domain | `HUNTER_API_KEY` env var | `GET https://api.hunter.io/v2/domain-search` |
| NewsData.io (author filter) | Same 200 req/day | Fetch recent articles by a known journalist name | `NEWSDATA_API_KEY` env var | `q=authorname&language=en` query param |
| OpenRouter (existing) | Billed per token (user's key or platform key) | Beat tag inference from article titles, pitch body drafting | `OPENROUTER_API_KEY` env var | Existing `lib/ai/` service |

### Australian PR Context

Telum Media is the dominant AU/NZ journalist database (no free API). Medianet (AU) starts at $350/month. The approach for Australian journalists:

1. **Manual import** — Users export contacts from Qwoted (free web UI) or their own spreadsheets as CSV; Synthex provides an import flow.
2. **Australian news sources via GDELT** — GDELT indexes Australian outlets (theaustralian.com.au, smh.com.au, abc.net.au, afr.com, news.com.au). A domain filter on GDELT queries surfaces AU-specific coverage.
3. **Media Alliance / Press Council** — No API; used for journalist verification (manual).
4. **PRWire (MediaConnect AU)** — Australia's press release wire; self-service at ~$200/release. Phase 92 generates the press release; distribution is user's choice.

### What NOT to Build

- No Perigon journalist endpoint (paid-only at useful scale)
- No Twitter/X beat analysis (rate limits too severe)
- No LinkedIn scraping (ToS violation)
- No Telum / Medianet / Cision integrations (no free tier, no API key model)
- No email sending from Synthex for pitches — generate draft only, user sends from their own client (avoids spam/deliverability risk)
- No press release wire submission — generate the structured content; distribution is user's manual step

</standard_stack>

<architecture_patterns>

## Architecture Patterns

### File Structure

```
lib/pr/
  types.ts                    # JournalistContact, PRPitch, MediaCoverage, PressRelease types
  journalist-enricher.ts      # Hunter.io email lookup + GDELT beat research
  beat-classifier.ts          # OpenRouter: article titles → beat tags array
  pitch-lifecycle.ts          # Status transition rules, follow-up scheduling
  coverage-linker.ts          # Match BrandMention outlet domain → PRPitch journalist domain
  press-release-builder.ts    # Structured JSON-LD PressRelease schema generator

app/api/pr/
  journalists/
    route.ts                  # GET (list+search), POST (create contact)
    [id]/route.ts             # GET, PATCH, DELETE journalist
    [id]/enrich/route.ts      # POST → trigger Hunter.io + GDELT beat research
  pitches/
    route.ts                  # GET (list by status), POST (create pitch)
    [id]/route.ts             # GET, PATCH (status transition), DELETE
    [id]/draft/route.ts       # POST → OpenRouter pitch body generation
  coverage/
    route.ts                  # GET (coverage list), POST (manual add)
    poll/route.ts             # POST → trigger mention-poller, auto-link to pitches
  press-releases/
    route.ts                  # GET (list), POST (create)
    [id]/route.ts             # GET, PATCH, DELETE
    [id]/schema/route.ts      # GET → returns JSON-LD PressRelease markup

app/(dashboard)/pr/
  page.tsx                    # PR Dashboard: stats overview
  journalists/
    page.tsx                  # Journalist list + search
    [id]/page.tsx             # Journalist profile + pitch history
  pitches/
    page.tsx                  # Pitch kanban board (columns by status)
  coverage/
    page.tsx                  # Coverage feed (editorial mentions)
  press-releases/
    page.tsx                  # Press release list + editor
    [id]/page.tsx             # Single release editor
    [id]/preview/page.tsx     # Rendered newsroom preview

app/(public)/pr/
  [orgSlug]/[releaseSlug]/page.tsx   # Public newsroom page (AI-indexable)

components/pr/
  JournalistCard.tsx          # Contact card with beat tags, last pitch status
  JournalistEnrichForm.tsx    # Form: name + outlet domain → trigger enrichment
  PitchKanban.tsx             # Drag-free kanban: columns per status
  PitchCard.tsx               # Individual pitch card
  PitchStatusBadge.tsx        # Colour-coded status indicator
  CoverageFeed.tsx            # Editorial coverage list with pitch attribution
  PressReleaseEditor.tsx      # Rich text editor + structured fields
  BeatTagInput.tsx            # Tag input for journalist beats
```

### Prisma Models

```prisma
// Journalist contact — manually curated, API-enriched
model JournalistContact {
  id            String    @id @default(cuid())
  orgId         String
  userId        String    // who owns this contact record

  // Identity
  name          String
  email         String?
  emailVerified Boolean   @default(false)
  emailScore    Int?      // Hunter.io confidence score 0-100
  outlet        String    // Publication name e.g. "The Australian"
  outletDomain  String    // e.g. "theaustralian.com.au"
  title         String?   // "Senior Technology Reporter"
  location      String?   // City/region e.g. "Sydney, NSW"

  // Beat & coverage data
  beats         String[]  // ["technology", "startups", "venture capital"]
  recentArticles Json?    // Array of { url, title, publishedAt } last 5 bylines
  beatsUpdatedAt DateTime?
  twitterHandle String?
  linkedinUrl   String?

  // Relationship tracking
  notes         String?   @db.Text
  tier          String    @default("cold")  // 'cold' | 'warm' | 'hot' | 'advocate'
  lastContactedAt DateTime?
  doNotContact  Boolean   @default(false)

  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  pitches       PRPitch[]
  coverage      MediaCoverage[]
  org           Organization @relation(fields: [orgId], references: [id])
  user          User         @relation(fields: [userId], references: [id])

  @@index([orgId])
  @@index([userId])
  @@index([outletDomain])
  @@index([tier])
}

// Individual pitch to a journalist
model PRPitch {
  id              String    @id @default(cuid())
  orgId           String
  userId          String
  journalistId    String

  // Content
  subject         String
  angle           String    @db.Text   // 1-2 sentence pitch angle
  bodyDraft       String?   @db.Text   // AI-generated or user-written draft
  personalisation String?   @db.Text   // Personalised hook for this journalist

  // Lifecycle status
  // 'draft' | 'sent' | 'opened' | 'replied' | 'covered' | 'declined' | 'archived'
  status          String    @default("draft")
  sentAt          DateTime?
  openedAt        DateTime?
  repliedAt       DateTime?
  followUpAt      DateTime? // Scheduled follow-up date
  followUpCount   Int       @default(0)

  // Attribution
  campaignId      String?   // Optional link to marketing campaign
  tags            String[]  // e.g. ["product-launch", "funding"]

  // Timestamps
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  journalist      JournalistContact @relation(fields: [journalistId], references: [id])
  coverage        MediaCoverage[]
  org             Organization @relation(fields: [orgId], references: [id])
  user            User         @relation(fields: [userId], references: [id])

  @@index([orgId])
  @@index([userId])
  @@index([journalistId])
  @@index([status])
  @@index([followUpAt])
}

// Editorial coverage — distinct from BrandMention (has pitch attribution)
model MediaCoverage {
  id              String    @id @default(cuid())
  orgId           String
  userId          String
  pitchId         String?   // null = organic/unpitched coverage
  journalistId    String?   // null = discovered without journalist match

  // Article data
  url             String
  urlHash         String    // Normalised URL hash for dedup (same djb2 pattern as BrandMention)
  title           String
  description     String?   @db.Text
  outlet          String
  outletDomain    String
  publishedAt     DateTime?
  apiSource       String    // 'gdelt' | 'newsdata' | 'manual' | 'rss'

  // Quality signals
  estimatedReach  Int?      // Rough audience size (Alexa rank proxy or user-entered)
  sentiment       String    @default("neutral")  // 'positive' | 'neutral' | 'negative'
  tier            String    @default("tier3")    // 'tier1' | 'tier2' | 'tier3'

  // Timestamps
  createdAt       DateTime  @default(now())

  // Relations
  pitch           PRPitch?          @relation(fields: [pitchId], references: [id])
  journalist      JournalistContact? @relation(fields: [journalistId], references: [id])
  org             Organization @relation(fields: [orgId], references: [id])
  user            User         @relation(fields: [userId], references: [id])

  @@unique([urlHash, orgId])
  @@index([orgId])
  @@index([pitchId])
  @@index([journalistId])
  @@index([publishedAt])
}

// Press release — stored content for newsroom publication
model PressRelease {
  id              String    @id @default(cuid())
  orgId           String
  userId          String

  // Content
  slug            String    // URL slug e.g. "synthex-raises-seed-round-march-2026"
  headline        String
  subheading      String?
  body            String    @db.Text  // Markdown
  boilerplate     String?   @db.Text  // About the company blurb
  contactName     String?
  contactEmail    String?
  contactPhone    String?

  // Metadata for structured data
  datePublished   DateTime?
  location        String?   // "Sydney, NSW, Australia"
  category        String?   // "funding" | "product" | "partnership" | "award" | "other"
  keywords        String[]
  imageUrl        String?

  // Distribution
  status          String    @default("draft")  // 'draft' | 'published' | 'archived'
  publishedAt     DateTime?
  distributedTo   String[]  // User-entered wire names e.g. ["PRWire", "BusinessWire"]

  // Timestamps
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  org             Organization @relation(fields: [orgId], references: [id])
  user            User         @relation(fields: [userId], references: [id])

  @@unique([orgId, slug])
  @@index([orgId])
  @@index([status])
  @@index([datePublished])
}
```

### Key TypeScript Patterns

**Hunter.io Email Finder (lib/pr/journalist-enricher.ts)**

```typescript
interface HunterEmailResult {
  data: {
    email: string | null;
    score: number;    // 0-100 confidence
    position: string | null;
  };
}

export async function lookupJournalistEmail(
  firstName: string,
  lastName: string,
  domain: string
): Promise<{ email: string | null; score: number }> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return { email: null, score: 0 };

  const url = `https://api.hunter.io/v2/email-finder?` +
    `first_name=${encodeURIComponent(firstName)}&` +
    `last_name=${encodeURIComponent(lastName)}&` +
    `domain=${encodeURIComponent(domain)}&` +
    `api_key=${apiKey}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return { email: null, score: 0 };

  const data: HunterEmailResult = await res.json();
  return {
    email: data.data.email ?? null,
    score: data.data.score ?? 0,
  };
}
```

**GDELT Beat Research (lib/pr/journalist-enricher.ts)**

```typescript
// Fetch recent articles by outlet to infer journalist beat
export async function fetchRecentArticlesByOutlet(
  outletDomain: string,
  maxRecords = 5
): Promise<Array<{ url: string; title: string; publishedAt: string | null }>> {
  const query = encodeURIComponent(`site:${outletDomain}`);
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?` +
    `query=${query}&mode=artlist&maxrecords=${maxRecords}&format=json&sort=datedesc`;

  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.articles ?? [])
    .filter((a: { url?: string; title?: string }) => a.url && a.title)
    .map((a: { url: string; title: string; seendate?: string }) => ({
      url: a.url,
      title: a.title,
      publishedAt: a.seendate ? gdeltDateToIso(a.seendate) : null,
    }));
}
```

**Beat Classification via OpenRouter (lib/pr/beat-classifier.ts)**

```typescript
// Uses existing lib/ai/ pattern — no new package
export async function classifyJournalistBeats(
  articleTitles: string[],
  outlet: string
): Promise<string[]> {
  // Call OpenRouter with structured output request
  // Returns array like ["technology", "startups", "venture capital", "AI"]
  const prompt = [
    `Analyse these recent article titles from a journalist at "${outlet}".`,
    `Return a JSON array of 2-5 topic tags (lowercase, singular nouns) that describe their beat.`,
    `Titles:\n${articleTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`,
    `Respond with ONLY a JSON array, e.g. ["technology", "startups"]`,
  ].join('\n');

  // ... OpenRouter call using existing lib/ai/ pattern ...
}
```

**Coverage Auto-Linking (lib/pr/coverage-linker.ts)**

```typescript
// After mention-poller runs, check if mention outlet matches any pitched journalist
export async function linkCoverageToPitches(
  orgId: string,
  mentions: RawMention[]  // from existing pollMentions()
): Promise<void> {
  // For each mention, check outletDomain against JournalistContact.outletDomain
  // where that journalist has a PRPitch with status 'sent' | 'opened' | 'replied'
  // If match: create MediaCoverage record, update PRPitch.status = 'covered'
}
```

**Press Release JSON-LD (lib/pr/press-release-builder.ts)**

```typescript
// schema.org/PressRelease JSON-LD for AI indexing
export function buildPressReleaseSchema(release: PressRelease, orgName: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "PressRelease",    // Supported by ChatGPT/Perplexity crawlers
    "headline": release.headline,
    "description": release.subheading ?? undefined,
    "datePublished": release.datePublished?.toISOString(),
    "author": {
      "@type": "Organization",
      "name": orgName,
    },
    "publisher": {
      "@type": "Organization",
      "name": orgName,
    },
    "keywords": release.keywords.join(", "),
    "locationCreated": {
      "@type": "Place",
      "name": release.location ?? "Australia",
    },
    "articleBody": release.body,
  };
}
```

### Press Release AI Indexing Strategy

Research confirms (2026) that AI engines (ChatGPT Search, Perplexity, Google AI Overviews) use these signals:

1. **`schema.org/PressRelease` JSON-LD** — Machine-readable type signal; helps LLMs attribute and cite content.
2. **`NewsArticle` schema as fallback** — More widely recognised by older crawlers; include both in `<script type="application/ld+json">`.
3. **Clean, question-answering prose** — Short paragraphs, headers with keywords, one key claim per paragraph.
4. **Authoritative distribution** — Publishing on a credible domain matters more than wire services alone. A self-hosted `/pr/[slug]` page on `synthex.com.au` or the customer's own domain is sufficient if the domain has authority.
5. **Consistent entity naming** — Match the org name exactly as it appears in Phase 91's `BrandIdentity.canonicalName` and entity graph.
6. **`@type: PressRelease`** — Launched by Media OutReach Newswire in March 2026 as an explicit schema type for AI visibility. Use it.

### Coverage Monitoring Reuse Decision

`lib/brand/mention-poller.ts` is reused **without modification** for coverage monitoring. The difference between `BrandMention` (Phase 91) and `MediaCoverage` (Phase 92) is the **pitch attribution layer** applied after polling:

```
pollMentions(brandName) → RawMention[]
  ↓
deduplicateMentions()   → RawMention[] (already done inside pollMentions)
  ↓
linkCoverageToPitches() → creates MediaCoverage records, links to PRPitch, updates status
  ↓
Unlinked mentions also stored as MediaCoverage (organic/unpitched)
```

This avoids duplicating monitoring logic. The cron job at `app/api/cron/pr-coverage-poll/route.ts` calls `pollMentions()` then `linkCoverageToPitches()`.

</architecture_patterns>

<pitfalls>

## Common Pitfalls

### API / Data

1. **GDELT author attribution is unreliable** — GDELT indexes articles but does not consistently expose the byline. Do not rely on GDELT to confirm which journalist wrote a specific article. Use it for outlet-level discovery and brand mention monitoring only.

2. **NewsData.io author filter is weak on free tier** — The free plan does not support author-name filtering with high accuracy. Beat research via author search will produce false positives. Use outlet domain + OpenRouter classification instead.

3. **Hunter.io 50 credit/month limit is real** — 50 email lookups per month is small. Implement credit-awareness: check `GET /v2/account` for remaining credits before each lookup, cache results in the `JournalistContact.email` field permanently once found, and surface the "Email not found" state gracefully.

4. **GDELT can return 0 results for niche Australian outlets** — GDELT indexes major outlets well (smh.com.au, theaustralian.com.au, abc.net.au) but may miss regional papers. For Australian users, supplement with manual contact entry.

5. **Beat tags drift** — A journalist changes beat when they change role. `beatsUpdatedAt` field exists to trigger re-enrichment. Add a staleness threshold (90 days) to the UI to prompt re-classification.

### Pitch Tracking

6. **Email open tracking requires tracking pixels** — We are NOT sending email from Synthex. The `opened` status must be manually set by the user (or omitted). Do not implement tracking pixel infrastructure. The pitch status UI should make manual status update easy (one-click).

7. **Follow-up scheduling without email send** — `followUpAt` is a reminder date, not an automated send trigger. Surface it as a notification / dashboard card — "3 pitches due for follow-up today".

8. **Duplicate pitches** — Users may pitch the same journalist multiple times. Allow this but surface a warning: "You have 2 previous pitches to this journalist (last: 45 days ago, status: no reply)".

### Coverage Monitoring

9. **BrandMention vs MediaCoverage confusion** — Phase 91's `BrandMention` and Phase 92's `MediaCoverage` both monitor editorial content. Keep them separate. `BrandMention` is broad brand signal. `MediaCoverage` is specifically editorial coverage that may be attributable to a PR pitch. Do not merge the tables — they serve different analytical purposes.

10. **URL hash collision between models** — Both `BrandMention` and `MediaCoverage` use `urlHash` for deduplication. The unique constraint is `[urlHash, brandId]` in BrandMention and `[urlHash, orgId]` in MediaCoverage. An article CAN appear in both tables (monitored as brand mention AND linked to a pitch). This is correct behaviour.

### Press Releases

11. **`schema.org/PressRelease` is not yet in Google's Rich Results** — The schema type exists and AI crawlers use it, but Google does not display rich results for it. Use `NewsArticle` as the primary type for Google, `PressRelease` as secondary. Include both:
    ```json
    { "@type": ["NewsArticle", "PressRelease"], ... }
    ```

12. **Public newsroom route requires no auth** — The `/pr/[orgSlug]/[releaseSlug]` route must be publicly accessible with no Supabase session check. Use `app/(public)/` layout group with no auth middleware.

13. **Slug uniqueness** — Press release slugs must be unique per org (enforced by `@@unique([orgId, slug])`). Auto-generate slug from headline on creation; allow user to edit before publishing.

### Australian PR Specifics

14. **No free Australian journalist API exists** — Telum Media (the dominant AU/NZ database) has no public API and starts at custom pricing. Medianet (AU) starts at $350/month. The correct approach for Phase 92 is to position Synthex as a bring-your-own-contacts system that augments manual lists with free API enrichment. Do not over-promise AU journalist discovery.

15. **PRWire vs AAP Medianet** — Australia has two main wires: PRWire (MediaConnect, ~$200/release) and Medianet ($350+/month subscription). Phase 92 generates the press release content; wire submission is a user action. Do not build wire API integrations.

</pitfalls>

<plan_breakdown>

## Recommended Plan Breakdown

**Plan 92-01: Prisma Models + Core Service Layer**
Scope: Add `JournalistContact`, `PRPitch`, `MediaCoverage`, `PressRelease` to `prisma/schema.prisma`. Push schema. Create `lib/pr/types.ts`, `lib/pr/journalist-enricher.ts` (Hunter.io email lookup + GDELT beat research), `lib/pr/beat-classifier.ts` (OpenRouter beat inference). Unit tests for enricher and classifier.

**Plan 92-02: Journalist CRM — API Routes + UI**
Scope: `app/api/pr/journalists/` CRUD routes with Zod validation and org scoping. `app/api/pr/journalists/[id]/enrich/` route (triggers Hunter + GDELT). Components: `JournalistCard.tsx`, `JournalistEnrichForm.tsx`, `BeatTagInput.tsx`. Dashboard page: `/dashboard/pr/journalists/`. CSV import flow for bulk contact upload.

**Plan 92-03: Pitch Tracker — Lifecycle API + Kanban UI**
Scope: `app/api/pr/pitches/` CRUD + status transition routes. `app/api/pr/pitches/[id]/draft/` route (OpenRouter pitch body generation). `lib/pr/pitch-lifecycle.ts` (valid status transitions, follow-up scheduling). Components: `PitchKanban.tsx`, `PitchCard.tsx`, `PitchStatusBadge.tsx`. Dashboard page: `/dashboard/pr/pitches/`. Follow-up reminder cards on PR overview page.

**Plan 92-04: Coverage Monitor + Coverage-Pitch Auto-Linking**
Scope: `lib/pr/coverage-linker.ts` (outlet domain matching, auto-link mentions to pitches). `app/api/pr/coverage/` routes (list, manual add). `app/api/cron/pr-coverage-poll/` route (calls `pollMentions()` → `linkCoverageToPitches()`). `CoverageFeed.tsx` component. Dashboard page: `/dashboard/pr/coverage/`. Vercel cron config for daily polling.

**Plan 92-05: Press Release Editor + Public Newsroom**
Scope: `lib/pr/press-release-builder.ts` (JSON-LD schema generator). `app/api/pr/press-releases/` CRUD + schema endpoint. `PressReleaseEditor.tsx` (rich text + structured fields). Dashboard page: `/dashboard/pr/press-releases/`. Public route: `app/(public)/pr/[orgSlug]/[releaseSlug]/page.tsx` with full JSON-LD injection, no-auth access, Open Graph tags, and sitemap entry generation.

**Plan 92-06: PR Dashboard Overview + Integration Polish**
Scope: PR overview dashboard with pipeline stats (journalists by tier, pitches by status, coverage count, press release count). Follow-up reminder widget. Navigation integration into existing sidebar. End-to-end smoke test: create journalist → create pitch → poll coverage → auto-link → view coverage feed. Type-check + lint pass.

</plan_breakdown>
