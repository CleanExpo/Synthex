# Phase 91: Personal & Business Brand Builder — Research

**Researched:** 2026-03-11
**Domain:** Knowledge Panel triggers, entity recognition, brand consistency for AI search, brand mention monitoring, structured data authority
**Confidence:** HIGH

<research_summary>
## Summary

Phase 91 builds an **Automated Brand Recognition System** — the engine that establishes E-E-A-T for individuals and organisations by (1) generating correct schema markup with entity graph connections, (2) auditing name/handle/NAP consistency across platforms, (3) tracking brand mentions via free news APIs and RSS, and (4) scheduling the publishing cadence and credential maintenance activities needed to sustain Knowledge Panel presence.

The domain breaks into three service areas: **BrandIdentity** (who the entity is — schema, sameAs graph, Wikidata entry quality), **BrandConsistency** (cross-platform coherence — NAP, handle variants, entity disambiguation for AI), and **BrandMentions** (monitoring — news APIs, RSS aggregation, citation tracking in AI search results).

Research confirms that all core capabilities can be implemented with:
- Pure TypeScript schema generation (extending existing `lib/seo/schema-markup-service.ts`)
- Free/low-cost news APIs (NewsData.io, GNews, The Guardian Open Platform, GDELT)
- Google Knowledge Graph Search API (free — 100 req/day default, requestable increase)
- Wikidata REST API (completely free, no auth required for reads)
- No paid SaaS brand monitoring tools required

The existing `AuthorProfile` model (lines 2380–2410 of schema.prisma) already covers author-level identity and sameAs linking. Phase 91 must extend it — not duplicate it — by adding `BrandIdentity` (org-level entity management), `BrandCredential` (verifiable credentials/milestones), and `BrandMention` (monitored mentions). The new dashboard follows the existing `/dashboard/geo/` split-panel pattern.

**Primary recommendation:** Build on top of existing `lib/seo/schema-markup-service.ts` for schema generation. Add a `lib/brand/` service layer (entity-graph builder, consistency scorer, mention poller). Use NewsData.io (200 req/day free) as primary mention API, with The Guardian and GDELT as supplementary sources. Store mentions in `BrandMention` with deduplication by URL. Calendar logic is pure TypeScript (no external calendar API needed).
</research_summary>

<standard_stack>
## Standard Stack

### Core Infrastructure (No New Packages Needed)
| Approach | Purpose | Why |
|----------|---------|-----|
| Extend `lib/seo/schema-markup-service.ts` | Entity schema generation (Person, Organization, LocalBusiness) | Already validated, 14 types supported — extend, don't fork |
| Pure TypeScript | Consistency scorer, entity graph builder, calendar logic | Same pattern as `lib/geo/tactic-scorer.ts` |
| Existing Prisma 6 | BrandIdentity, BrandCredential, BrandMention persistence | Already in project |
| Existing `lib/geo/feature-limits.ts` | Feature gating for brand features | Extend existing pattern |
| Native `fetch()` in API routes | News API polling, Wikidata REST queries | Server-side API routes, not client components |

### APIs (Free Tier Only)
| API | Free Limit | Use Case | Auth |
|-----|-----------|----------|------|
| NewsData.io | 200 req/day, 10 results/req | Primary mention monitoring | API key (env var) |
| GNews API | 100 req/day | Supplementary mention monitoring | API key (env var) |
| The Guardian Open Platform | 500 req/day, full article text | High-quality editorial mention monitoring | API key (env var) |
| GDELT Project | Unlimited (no auth) | Global news signal, entity trend tracking | None — public BigQuery/REST |
| Google Knowledge Graph Search API | 100 req/day (requestable increase) | Entity confidence score, KGMID lookup | Google Cloud API key |
| Wikidata REST API | Unlimited | Entity Q-ID lookup, property enrichment | None required |
| Google Alerts RSS | Unlimited | Real-time brand mention RSS feed | None — user's own alerts |

### What NOT to Build
- ❌ **Mention** or **Brand24** integrations — paid SaaS, violates budget constraint
- ❌ **Custom RSS parser from scratch** — use native `DOMParser` / simple regex on RSS XML; no `rss-parser` npm package needed
- ❌ **Custom notification system** — reuse existing notification infrastructure
- ❌ **New calendar UI from scratch** — pure date/interval logic exposed as JSON, rendered with existing Radix UI primitives
- ❌ **LLM-based entity extraction** — use structured API responses directly; no AI call needed for mention parsing
- ❌ **Wikipedia editing tools** — do not build Wikipedia article creation; guide only (Wikidata is the actionable path)
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended File Structure
```
lib/brand/
├── types.ts                    # BrandEntityGraph, ConsistencyReport, MentionResult, BrandCalendar
├── entity-graph-builder.ts     # Build @id-connected schema graph for Person/Org
├── consistency-scorer.ts       # NAP + handle variant scorer — pure TypeScript
├── mention-poller.ts           # Multi-API mention aggregator (NewsData, GNews, Guardian, GDELT)
├── mention-deduplicator.ts     # URL-based dedup + similarity hashing
├── wikidata-checker.ts         # Wikidata Q-ID lookup + property gap analyser
├── kg-confidence-checker.ts    # Google Knowledge Graph API — entity confidence score
└── brand-calendar.ts           # Publishing cadence + credential refresh schedule generator

app/api/brand/
├── identity/route.ts           # POST — generate entity schema graph
├── consistency/route.ts        # POST — audit NAP + handle consistency across platforms
├── mentions/route.ts           # GET — fetch recent brand mentions (with caching)
├── mentions/poll/route.ts      # POST — trigger manual mention poll (cron-compatible)
├── wikidata/route.ts           # GET — check Wikidata entry completeness
├── kg-check/route.ts           # GET — query Google Knowledge Graph for entity confidence
└── calendar/route.ts           # POST — generate brand calendar from identity + mentions

app/dashboard/brand/
├── page.tsx                    # Brand dashboard (tabs: Identity | Consistency | Mentions | Calendar)
└── [id]/page.tsx               # Individual brand identity detail view

components/brand/
├── BrandIdentityCard.tsx       # Entity schema + sameAs graph status
├── ConsistencyAuditPanel.tsx   # Per-platform name/handle/NAP status matrix
├── BrandMentionsFeed.tsx       # Chronological mentions feed with sentiment badges
├── WikidataStatusCard.tsx      # Q-ID, confidence score, property gap list
├── KnowledgePanelStatus.tsx    # Google KG confidence score + KGMID display
└── BrandCalendarView.tsx       # Weekly/monthly publishing + credential schedule

prisma/schema.prisma additions:
├── BrandIdentity               # Org/Person entity with schema graph, sameAs, Wikidata Q-ID
├── BrandCredential             # Verifiable credential/milestone with expiry
└── BrandMention                # Monitored mention (URL, source, sentiment, date)
```

### Pattern 1: Entity Graph Builder
**What:** Generates a fully connected JSON-LD entity graph using `@id` anchors
**When:** When user saves a brand profile — generates the complete markup ready to paste into `<head>`

The key insight is that schema alone is not enough. An entity graph links every page schema block back to a single `@id` anchor, creating a web that Google can traverse.

```typescript
// lib/brand/entity-graph-builder.ts pattern
export interface EntityGraph {
  organizationSchema: Record<string, unknown>;   // On layout — sitewide
  websiteSchema: Record<string, unknown>;        // On homepage
  personSchema?: Record<string, unknown>;        // If personal brand
  articleAuthorRef: Record<string, unknown>;     // On every article — references @id only
}

export function buildOrganizationEntityGraph(identity: BrandIdentityInput): EntityGraph {
  const orgId = `${identity.canonicalUrl}/#organization`;
  const websiteId = `${identity.canonicalUrl}/#website`;

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': identity.hasPhysicalLocation ? 'LocalBusiness' : 'Organization',
    '@id': orgId,
    name: identity.canonicalName,  // Use CANONICAL name — must match sameAs profiles
    url: identity.canonicalUrl,
    logo: {
      '@type': 'ImageObject',
      '@id': `${identity.canonicalUrl}/#logo`,
      url: identity.logoUrl,
      width: 512,
      height: 512,
      caption: identity.canonicalName,
    },
    description: identity.description,
    foundingDate: identity.foundingDate,
    sameAs: buildSameAsArray(identity),  // Prioritised list — see sameAs priority table below
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': websiteId,
    name: identity.canonicalName,
    url: identity.canonicalUrl,
    publisher: { '@id': orgId },
    potentialAction: identity.hasSearch ? {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${identity.canonicalUrl}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    } : undefined,
  };

  // Per-article reference — no repetition of full data
  const articleAuthorRef = { '@id': orgId };

  return { organizationSchema, websiteSchema, articleAuthorRef };
}

function buildSameAsArray(identity: BrandIdentityInput): string[] {
  // sameAs priority order — highest KP weight first
  const sameAs: string[] = [];
  if (identity.wikidataUrl) sameAs.push(identity.wikidataUrl);       // Very High
  if (identity.wikipediaUrl) sameAs.push(identity.wikipediaUrl);     // Highest
  if (identity.linkedinUrl) sameAs.push(identity.linkedinUrl);       // High
  if (identity.crunchbaseUrl) sameAs.push(identity.crunchbaseUrl);   // High
  if (identity.youtubeUrl) sameAs.push(identity.youtubeUrl);         // High
  if (identity.twitterUrl) sameAs.push(identity.twitterUrl);         // Medium
  if (identity.facebookUrl) sameAs.push(identity.facebookUrl);       // Medium
  if (identity.instagramUrl) sameAs.push(identity.instagramUrl);     // Low-Medium
  return sameAs;
}
```

### Pattern 2: NAP + Handle Consistency Scorer
**What:** Compares the brand's canonical name/address/phone against what appears on each declared platform. Returns a consistency score (0–100) and flags variants.
**Key insight:** 95%+ entity consistency correlates with 78% higher AI citation rates (SEOEngine.ai research). Even subtle variants like "Acme Corp" vs "Acme Corporation" vs "Acme Inc" create separate Knowledge Graph nodes.

```typescript
// lib/brand/consistency-scorer.ts pattern
export interface ConsistencyResult {
  platformUrl: string;
  platform: string;
  canonicalName: string;
  foundName: string | null;
  nameMatch: 'exact' | 'variant' | 'mismatch' | 'not-found';
  issues: string[];
  score: number; // 0-100
}

export interface ConsistencyReport {
  overallScore: number;        // Weighted average across all platforms
  results: ConsistencyResult[];
  criticalIssues: string[];    // sameAs platforms with mismatches — highest impact
  recommendations: string[];
}

// Name variant detection — covers the most common fragmentation patterns
function detectNameVariant(
  canonical: string,
  found: string
): 'exact' | 'variant' | 'mismatch' {
  if (canonical === found) return 'exact';
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b\.?/g, '')
      .replace(/[.,&]/g, '')
      .trim();
  if (normalize(canonical) === normalize(found)) return 'variant';
  return 'mismatch';
}
```

### Pattern 3: Multi-API Mention Poller
**What:** Queries 2–3 news APIs in parallel, deduplicates by URL, stores unique results in `BrandMention`
**Rate limit strategy:** Cache results for 1 hour minimum; poll at most once per hour via cron

```typescript
// lib/brand/mention-poller.ts pattern
interface RawMention {
  url: string;
  title: string;
  description: string | null;
  publishedAt: string;      // ISO timestamp
  source: string;           // Domain name
  apiSource: 'newsdata' | 'gnews' | 'guardian' | 'gdelt';
}

async function pollNewsDataIo(
  query: string,
  apiKey: string
): Promise<RawMention[]> {
  const url = new URL('https://newsdata.io/api/1/news');
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('q', `"${query}"`);  // Exact phrase match
  url.searchParams.set('language', 'en');
  url.searchParams.set('size', '10');

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = await res.json() as { results?: NewsDataArticle[] };
  return (data.results ?? []).map(mapNewsDataArticle);
}

async function pollGDELT(query: string): Promise<RawMention[]> {
  // GDELT 2.0 DOC API — completely free, no auth
  const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  url.searchParams.set('query', `"${query}"`);
  url.searchParams.set('mode', 'artlist');
  url.searchParams.set('maxrecords', '10');
  url.searchParams.set('format', 'json');
  url.searchParams.set('sort', 'datedesc');

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = await res.json() as { articles?: GDELTArticle[] };
  return (data.articles ?? []).map(mapGDELTArticle);
}

// Dedup: normalise URL (strip UTM params, trailing slashes) → Set of canonical URLs
function deduplicateMentions(mentions: RawMention[]): RawMention[] {
  const seen = new Set<string>();
  return mentions.filter(m => {
    const canonical = normaliseUrl(m.url);
    if (seen.has(canonical)) return false;
    seen.add(canonical);
    return true;
  });
}

function normaliseUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove UTM and tracking params
    ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'src'].forEach(p => u.searchParams.delete(p));
    return u.origin + u.pathname.replace(/\/$/, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
```

### Pattern 4: Wikidata Entry Checker
**What:** Queries the Wikidata REST API to find a brand's Q-ID, then audits which key properties are present/missing
**Key insight:** A Wikidata entry with thin references (single source for all claims) is nearly as weak as no entry. The system should flag missing properties and insufficient reference diversity.

```typescript
// lib/brand/wikidata-checker.ts pattern
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

// Key properties for an Organisation entity
const ORG_REQUIRED_PROPS = ['P31', 'P856', 'P571'] as const;  // instance-of, website, inception
const ORG_RECOMMENDED_PROPS = ['P159', 'P112', 'P18', 'P2671'] as const; // HQ, founder, image, KGMID

type WikidataPropId = typeof ORG_REQUIRED_PROPS[number] | typeof ORG_RECOMMENDED_PROPS[number];

export interface WikidataCheckResult {
  found: boolean;
  qId: string | null;
  entityLabel: string | null;
  presentProps: WikidataPropId[];
  missingRequiredProps: WikidataPropId[];
  missingRecommendedProps: WikidataPropId[];
  referenceCount: number;       // Total references across all claims
  singleSourceRisk: boolean;    // true if >80% of references cite same domain
  completenessScore: number;    // 0-100
  identifiers: Record<string, string>; // External IDs (LinkedIn, Crunchbase, Twitter, etc.)
}

async function searchWikidata(name: string, url: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'wbsearchentities',
    search: name,
    language: 'en',
    type: 'item',
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`${WIKIDATA_API}?${params}`, { signal: AbortSignal.timeout(5000) });
  const data = await res.json() as { search: WikidataSearchResult[] };
  // Match by official website URL if possible, else by label
  const byUrl = data.search.find(r => r.description?.includes(new URL(url).hostname));
  return byUrl?.id ?? data.search[0]?.id ?? null;
}
```

### Pattern 5: Brand Calendar Generator
**What:** Pure TypeScript function that generates a structured calendar of recommended brand-building activities based on brand profile completeness and recent mention velocity
**Output:** JSON calendar consumed by `BrandCalendarView.tsx`

```typescript
// lib/brand/brand-calendar.ts pattern
export interface CalendarEntry {
  date: string;           // ISO date
  type: 'publish' | 'citation-push' | 'credential-refresh' | 'mention-review' | 'schema-audit';
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  linkedCredentialId?: number;
}

export function generateBrandCalendar(
  identity: BrandIdentity,
  credentials: BrandCredential[],
  mentionCount30d: number,
): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  const today = new Date();

  // Publishing cadence — based on current authority level
  const publishIntervalDays = mentionCount30d > 20 ? 3 : mentionCount30d > 5 ? 7 : 14;

  // Credential refresh schedule
  for (const cred of credentials) {
    if (cred.expiresAt) {
      const daysUntilExpiry = Math.floor(
        (new Date(cred.expiresAt).getTime() - today.getTime()) / 86_400_000
      );
      if (daysUntilExpiry <= 90) {
        entries.push({
          date: offsetDate(today, daysUntilExpiry - 30),
          type: 'credential-refresh',
          title: `Renew: ${cred.title}`,
          description: `${cred.title} expires in ${daysUntilExpiry} days. Initiate renewal process.`,
          priority: daysUntilExpiry <= 30 ? 'critical' : 'high',
          linkedCredentialId: cred.id,
        });
      }
    }
  }

  // Weekly mention review
  for (let week = 0; week < 12; week++) {
    entries.push({
      date: offsetDate(today, week * 7),
      type: 'mention-review',
      title: 'Review Brand Mentions',
      description: 'Check new mentions for sentiment, reach, and citation opportunities.',
      priority: 'medium',
    });
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}
```

### Anti-Patterns to Avoid
- **sameAs without `@id`:** Adding `sameAs` to schema without setting `@id` is the most common mistake. Without `@id`, Google cannot connect separate schema blocks into one entity — each block is read in isolation.
- **Schema on only the homepage:** The `Organization` or `Person` schema with `@id` must appear on every page that references the entity. Use `{ '@id': orgId }` reference blocks on inner pages rather than repeating the full schema.
- **Monitoring brand name without quotes:** Querying news APIs without exact-phrase quoting (`"Brand Name"`) produces a flood of unrelated results. Always use quoted queries.
- **Over-polling news APIs:** Free tiers are daily limits. Poll once per hour maximum via cron — not on every user page load. Cache results in the database.
- **Claiming a Wikidata entry will guarantee a Knowledge Panel:** Wikidata is one signal among many. The system must communicate realistic timelines (weeks to months) and explain the multi-signal requirement clearly in the UI.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema generation | New template system | Extend `lib/seo/schema-markup-service.ts` | Already has 14 types, validation, preview — add `@id` + entity graph layer on top |
| Feature gating | New subscription check | Extend `lib/geo/feature-limits.ts` | Handles all plans, backward-compat |
| Auth in API routes | New auth pattern | `getUserIdFromRequest(request)` from `lib/auth/` | Existing pattern |
| Zod validation | Manual body parsing | `schema.safeParse(body)` | Already in every route |
| Rate limiting | New rate limiter | `RateLimiter` from `lib/rate-limit/` | Proven pattern |
| Dashboard tabs | New tab pattern | Copy `/dashboard/geo/` tab structure | Consistent UX |
| Author-level entity data | New author schema | Extend existing `AuthorProfile` model | Already has `sameAsUrls`, `credentials`, `eeatScore` |
| RSS parsing | `rss-parser` npm package | Native fetch + regex extraction of `<item>` tags | No new deps, RSS is simple XML |
| Calendar UI | Full calendar library | Radix UI + date-fns (already in project) | Consistent with existing date handling |
| Wikipedia article creation | Editing interface | Guidance only — link to Wikipedia's submission process | Cannot and should not automate Wikipedia editing |
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Canonical Name Drift
**What goes wrong:** User enters their brand name differently in Synthex than they use on LinkedIn, Crunchbase, and their own website — making the consistency audit always show mismatches regardless of actual platform state.
**Why it happens:** Users are not conscious of the legal vs. trading vs. short-form name distinction.
**How to avoid:** At profile creation, explicitly ask for (1) Legal name, (2) Trading/display name, (3) Short form. The consistency scorer uses the trading name as canonical for schema, the legal name for Wikidata properties.
**Warning signs:** Consistency score is always 0 or 100 but user reports it feels wrong.

### Pitfall 2: sameAs List Growing Stale
**What goes wrong:** User changes their Twitter handle or LinkedIn URL, but the schema already deployed to their site has the old URL. Google follows old sameAs links, finds a dead or mismatched profile, and treats it as a negative entity signal.
**Why it happens:** sameAs is a point-in-time snapshot with no automatic update mechanism.
**How to avoid:** Add a `sameAsVerifiedAt` timestamp on `BrandIdentity`. Schedule a weekly verification job that pings each sameAs URL and checks the HTTP status. Flag 404s and redirects as action items.
**Warning signs:** User reports Knowledge Panel showing outdated social links.

### Pitfall 3: News API Rate Limit Exhaustion from Eager Polling
**What goes wrong:** Multiple users polling the same news API simultaneously exhausts the free daily limit within the first hour of a new day.
**Why it happens:** Each user poll is independent; no shared rate limit awareness.
**How to avoid:** Pool and cache mention results by search term, not by user. If two users both monitor "Acme Corp", one API call serves both. Implement a `MentionPollCache` table keyed by normalised query string and last-polled timestamp. Return cached results if polled within 1 hour.
**Warning signs:** API 429 errors appearing in logs at the same time each day.

### Pitfall 4: Entity Disambiguation Failure
**What goes wrong:** A user's brand name is also the name of a more famous entity (e.g., "Apex" as a company, but Apex Legends dominates the Knowledge Graph for "Apex"). The consistency checker and KG lookup return data for the wrong entity.
**Why it happens:** Knowledge Graph entity lookup returns results ranked by confidence — the most famous entity with that name wins.
**How to avoid:** Always disambiguate with the canonical URL when querying the Knowledge Graph API (`types=Organization` filter + URL corroboration). Store the confirmed KGMID (`/g/xxxxxx`) on `BrandIdentity` after first successful lookup — use KGMID for subsequent queries, not the name.
**Warning signs:** KG confidence score lookup returns data for a different company or famous person.

### Pitfall 5: Wikidata Edits Triggering Review/Deletion
**What goes wrong:** System generates Wikidata property suggestions, user follows them, but the entry gets flagged for conflict of interest or poor sourcing, damaging the entity's reputation in the Knowledge Graph.
**Why it happens:** Wikidata has community norms around self-editing and referencing policies that are easy to violate unknowingly.
**How to avoid:** The system generates a structured checklist for Wikidata editing — it does NOT automate Wikidata submissions. Present the checklist with explicit guidance: "Use independent sources (news articles, government registries, industry databases) as references — not your own website." Note the conflict-of-interest disclosure requirement.
**Warning signs:** User reports their Wikidata entry was merged or deleted after following guidance.

### Pitfall 6: Unrealistic Timeline Expectations
**What goes wrong:** User completes all recommended actions (schema, Wikidata, sameAs) and expects a Knowledge Panel to appear within days. When it does not appear after 2 weeks, they assume the feature is broken.
**Why it happens:** Knowledge Panel generation timelines range from 1–6 months depending on the entity's current authority level and the volume of corroborating signals.
**How to avoid:** Build timeline expectations directly into the UI. Show a "Status & Timeline" card with realistic ranges:
  - Established brand + Wikipedia + complete schema → 1–4 weeks
  - Growing brand + Wikidata + LinkedIn + Google Business Profile → 1–3 months
  - New brand + schema only → unlikely — build citations first
  - Personal brand + published content + press → 2–6 months
</common_pitfalls>

<api_integrations>
## API Integrations (Free / Low-Cost Only)

### 1. NewsData.io (Primary Mention Monitoring)
- **Free tier:** 200 requests/day, 10 articles/request, 30-day historical news
- **Env var:** `NEWSDATA_API_KEY`
- **Endpoint:** `GET https://newsdata.io/api/1/news?apikey={key}&q="Brand Name"&language=en`
- **Best for:** General brand mention monitoring, international coverage (206 countries, 89 languages)
- **Caching:** Cache results for 60 minutes minimum; use `nextPage` token for pagination

### 2. GNews API (Supplementary)
- **Free tier:** 100 requests/day, articles from past week
- **Env var:** `GNEWS_API_KEY`
- **Endpoint:** `GET https://gnews.io/api/v4/search?q="Brand Name"&lang=en&token={key}`
- **Best for:** Real-time news monitoring, full article content extraction
- **Note:** 1-week lookback limit — good for freshness, poor for historical

### 3. The Guardian Open Platform (High-Quality Mentions)
- **Free tier:** 500 requests/day, full article text, 1999 archive access
- **Env var:** `GUARDIAN_API_KEY`
- **Endpoint:** `GET https://content.guardianapis.com/search?q="Brand Name"&api-key={key}&show-fields=headline,bodyText`
- **Best for:** Editorial press mentions with full article text; high authority signals

### 4. GDELT Project (Signal & Trend Only)
- **Free tier:** Unlimited — no auth, no registration
- **Endpoint:** `GET https://api.gdeltproject.org/api/v2/doc/doc?query="Brand Name"&mode=artlist&maxrecords=10&format=json&sort=datedesc`
- **Best for:** Global coverage, entity trend data, mood/tone sentiment across news landscape
- **Caution:** Article URLs often redirect; verify before storing. Good for signal, not display.

### 5. Google Knowledge Graph Search API (Entity Confidence)
- **Free tier:** 100 requests/day default; requestable increase via Google Cloud
- **Env var:** `GOOGLE_KG_API_KEY`
- **Endpoint:** `GET https://kgsearch.googleapis.com/v1/entities:search?query={name}&key={key}&types=Organization&types=Person&indent=True`
- **Returns:** `@id` (KGMID), `name`, `description`, `detailedDescription`, `resultScore`
- **Store:** KGMID (`/g/xxxxxxxx`) on `BrandIdentity.kgmid` — use for subsequent lookups
- **Rate limit strategy:** Check at most once per day per entity; cache KGMID once found

### 6. Wikidata REST API (Entity Structure Audit)
- **Free tier:** Completely free, no authentication required for reads
- **Search endpoint:** `GET https://www.wikidata.org/w/api.php?action=wbsearchentities&search={name}&language=en&type=item&format=json`
- **Entity endpoint:** `GET https://www.wikidata.org/wiki/Special:EntityData/{Q-ID}.json`
- **Returns:** Full entity with all properties, labels, aliases, references per claim
- **Store:** Q-ID on `BrandIdentity.wikidataQId`

### 7. Google Alerts RSS (User-Configured)
- **Free tier:** Free — each Alert generates a unique RSS feed URL
- **Pattern:** User configures Google Alert for their brand name, pastes RSS feed URL into Synthex
- **Endpoint:** `GET {user-provided RSS URL}` — parse with native XML fetch
- **Best for:** Real-time mention delivery without API rate limits
- **No API key needed** — feed URL authenticates itself

### Rate Limit Management Strategy
```typescript
// Recommended polling schedule (via cron or on-demand)
// Each brand entity polls at most once per hour across all sources

const POLL_INTERVALS = {
  newsdata: 3600,    // 1 hour (200/day limit = 8/hour headroom)
  gnews: 7200,       // 2 hours (100/day limit = 4/hour headroom)
  guardian: 1800,    // 30 min (500/day limit = 20/hour headroom)
  gdelt: 900,        // 15 min (unlimited — respect server, cap at 4/hour)
  kg: 86400,         // 24 hours (100/day hard limit)
  wikidata: 3600,    // 1 hour (unlimited — be polite)
} as const;
```
</api_integrations>

<schema_models>
## Prisma Model Design

### Relationship to Existing Models
- `AuthorProfile` (existing) — individual author E-E-A-T; has `sameAsUrls`, `credentials`, `eeatScore`
- `BrandIdentity` (new) — org or personal brand entity; relates to `User` + `Organization`; may link to `AuthorProfile`
- `BrandCredential` (new) — verifiable milestones (press coverage, certifications, awards, speaking engagements)
- `BrandMention` (new) — individual mention from news API or RSS

### Proposed Model Shapes
```prisma
model BrandIdentity {
  id                String    @id @default(cuid())
  userId            String    @map("user_id")
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  organizationId    String?   @map("organization_id")
  // organization   Organization? @relation(...)  // Link to org if multi-user

  // Entity type
  entityType        String    @map("entity_type") // 'person' | 'organization' | 'local_business'

  // Canonical identity (the single source of truth for consistency checker)
  canonicalName     String    @map("canonical_name")   // Trading/display name
  legalName         String?   @map("legal_name")        // If different from canonical
  shortName         String?   @map("short_name")        // Abbreviation
  canonicalUrl      String    @map("canonical_url")     // Primary website URL
  description       String    @db.Text
  logoUrl           String?   @map("logo_url")
  foundingDate      String?   @map("founding_date")     // ISO date string

  // Entity graph identifiers
  wikidataQId       String?   @map("wikidata_q_id")    // e.g. "Q123456"
  wikidataUrl       String?   @map("wikidata_url")     // https://www.wikidata.org/wiki/QXXXXXX
  wikipediaUrl      String?   @map("wikipedia_url")    // English Wikipedia article URL
  kgmid             String?   @map("kgmid")            // Google KG ID: /g/xxxxxxxx
  kgConfidenceScore Float?    @map("kg_confidence_score")
  kgCheckedAt       DateTime? @map("kg_checked_at")

  // Social handles (canonical — what the consistency checker compares against)
  sameAsUrls        String[]  @map("same_as_urls")     // Ordered: Wikidata, Wikipedia, LinkedIn, ...
  sameAsVerifiedAt  DateTime? @map("same_as_verified_at")

  // Local business fields (only populated if entityType = 'local_business')
  streetAddress     String?   @map("street_address")
  city              String?
  state             String?
  postalCode        String?   @map("postal_code")
  country           String?
  phone             String?

  // Generated outputs
  entityGraphJson   Json?     @map("entity_graph_json")  // Full generated JSON-LD schema
  consistencyScore  Float?    @map("consistency_score")  // 0-100
  consistencyReport Json?     @map("consistency_report") // {results, criticalIssues, recommendations}
  lastConsistencyCheck DateTime? @map("last_consistency_check")

  // Mention monitoring
  monitoringEnabled Boolean   @default(true) @map("monitoring_enabled")
  monitoringQuery   String?   @map("monitoring_query") // Override search query if needed
  lastMentionPoll   DateTime? @map("last_mention_poll")
  googleAlertsRssUrl String?  @map("google_alerts_rss_url")

  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  // Relations
  credentials       BrandCredential[]
  mentions          BrandMention[]

  @@index([userId])
  @@index([canonicalName])
  @@index([kgmid])
  @@map("brand_identities")
}

model BrandCredential {
  id              Int       @id @default(autoincrement())
  brandId         String    @map("brand_id")
  brand           BrandIdentity @relation(fields: [brandId], references: [id], onDelete: Cascade)

  // Credential details
  type            String    // 'press_coverage' | 'certification' | 'award' | 'speaking' | 'publication' | 'case_study'
  title           String
  description     String?   @db.Text
  sourceUrl       String?   @map("source_url")  // URL of the press article, cert body, etc.
  issuingOrg      String?   @map("issuing_org")  // Publisher, awarding body, conference name
  issuedAt        DateTime? @map("issued_at")
  expiresAt       DateTime? @map("expires_at")   // For certifications with expiry

  // Wikidata reference eligibility
  isWikidataReferenceable Boolean @default(false) @map("is_wikidata_referenceable")
  // True if this credential is from an independent source suitable as a Wikidata reference

  // E-E-A-T signal weight
  authorityWeight Float     @default(1.0) @map("authority_weight")
  // 3.0 = major press (BBC, NYT), 2.0 = industry press, 1.0 = directory listing

  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  @@index([brandId])
  @@index([brandId, type])
  @@index([expiresAt])
  @@map("brand_credentials")
}

model BrandMention {
  id              Int       @id @default(autoincrement())
  brandId         String    @map("brand_id")
  brand           BrandIdentity @relation(fields: [brandId], references: [id], onDelete: Cascade)

  // Source
  url             String    // Canonical (UTM-stripped)
  urlHash         String    @map("url_hash") // SHA256 of canonical URL — for dedup index
  title           String
  description     String?   @db.Text
  sourceDomain    String    @map("source_domain")
  apiSource       String    @map("api_source") // 'newsdata' | 'gnews' | 'guardian' | 'gdelt' | 'rss'

  // Metadata
  publishedAt     DateTime  @map("published_at")
  sentiment       String?   // 'positive' | 'neutral' | 'negative' (from API or heuristic)
  authorityScore  Float?    @map("authority_score") // Estimated domain authority (0-100)

  // Wikidata reference eligibility
  isWikidataReferenceable Boolean @default(false) @map("is_wikidata_referenceable")
  // True if from an independent, established news domain (not the brand's own domain)

  createdAt       DateTime  @default(now()) @map("created_at")

  @@unique([urlHash, brandId])  // Dedup: one record per URL per brand
  @@index([brandId])
  @@index([brandId, publishedAt])
  @@index([brandId, apiSource])
  @@map("brand_mentions")
}
```
</schema_models>

<code_examples>
## Code Examples for Key Algorithms

### sameAs Priority & Completeness Score
```typescript
// lib/brand/entity-graph-builder.ts

// sameAs signal weight by platform — based on Knowledge Panel trigger research
const SAMEAS_WEIGHTS: Record<string, number> = {
  'wikidata.org': 10,      // Very High — Google's preferred structured source
  'wikipedia.org': 10,     // Highest — almost guarantees KP
  'linkedin.com': 8,       // High — strong entity signal for companies/people
  'crunchbase.com': 8,     // High — for funded companies
  'youtube.com': 8,        // High — especially if channel has subscribers
  'twitter.com': 5,        // Medium
  'x.com': 5,              // Medium (same as Twitter)
  'facebook.com': 5,       // Medium
  'instagram.com': 3,      // Low-medium
};

export function computeSameAsScore(sameAsUrls: string[]): {
  score: number;         // 0-100
  missingHighValue: string[];  // Platform names missing from sameAs
} {
  let totalWeight = 0;
  const maxWeight = Object.values(SAMEAS_WEIGHTS).reduce((a, b) => a + b, 0);
  const missingHighValue: string[] = [];

  for (const [domain, weight] of Object.entries(SAMEAS_WEIGHTS)) {
    const present = sameAsUrls.some(url => url.includes(domain));
    if (present) {
      totalWeight += weight;
    } else if (weight >= 8) {
      missingHighValue.push(domain.replace('.com', '').replace('.org', ''));
    }
  }

  return {
    score: Math.round((totalWeight / maxWeight) * 100),
    missingHighValue,
  };
}
```

### Wikidata Completeness Scorer
```typescript
// lib/brand/wikidata-checker.ts

const PERSON_PROPS = {
  required: {
    P31: 'instance of (human)',
    P21: 'sex or gender',
    P27: 'country of citizenship',
    P856: 'official website',
  },
  recommended: {
    P569: 'date of birth',
    P106: 'occupation',
    P108: 'employer',
    P69: 'educated at',
    P2671: 'Google Knowledge Graph ID',
    // Social identifiers
    P2002: 'Twitter/X username',
    P4264: 'LinkedIn personal profile ID',
    P2003: 'Instagram username',
    P2397: 'YouTube channel ID',
  },
} as const;

const ORG_PROPS = {
  required: {
    P31: 'instance of (organisation type)',
    P856: 'official website',
    P571: 'inception date',
  },
  recommended: {
    P159: 'headquarters location',
    P112: 'founder',
    P452: 'industry',
    P18: 'image/logo',
    P2671: 'Google Knowledge Graph ID',
    P1581: 'official blog URL',
    P2004: 'Crunchbase organisation ID',
    P4264: 'LinkedIn company ID',
  },
} as const;

export function scoreWikidataCompleteness(
  entityType: 'person' | 'organization',
  presentProps: string[]
): number {
  const props = entityType === 'person' ? PERSON_PROPS : ORG_PROPS;
  const requiredCount = Object.keys(props.required).length;
  const recommendedCount = Object.keys(props.recommended).length;

  const requiredPresent = Object.keys(props.required).filter(p => presentProps.includes(p)).length;
  const recommendedPresent = Object.keys(props.recommended).filter(p => presentProps.includes(p)).length;

  // Required props = 70% of score; recommended = 30%
  const requiredScore = (requiredPresent / requiredCount) * 70;
  const recommendedScore = (recommendedPresent / recommendedCount) * 30;

  return Math.round(requiredScore + recommendedScore);
}
```

### NAP Field Extraction Pattern (for Consistency Checking)
```typescript
// lib/brand/consistency-scorer.ts

// Normalise phone numbers for comparison — strip all non-digits
function normalisePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

// Levenshtein similarity for fuzzy name matching
function nameSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1.0;
  return (longer.length - editDistance(longer, shorter)) / longer.length;
}

// Consistency status categories
const NAP_STATUS = {
  EXACT: 'exact',         // Character-perfect match
  NORMALISED: 'variant',  // Matches after normalisation (Inc/LLC/Corp removal)
  SIMILAR: 'similar',     // >85% Levenshtein similarity
  MISMATCH: 'mismatch',   // <85% similarity — genuine inconsistency
  NOT_FOUND: 'not-found', // Platform not yet checked / 404 response
} as const;

// Overall score computation
// critical mismatch (sameAs platform) = -15 points each
// minor mismatch (unlisted platform) = -5 points each
// variant (normalised match) = -2 points each
export function computeOverallConsistencyScore(results: ConsistencyResult[]): number {
  const sameAsResults = results.filter(r => r.isSameAsListed);
  const otherResults = results.filter(r => !r.isSameAsListed);

  let score = 100;
  for (const r of sameAsResults) {
    if (r.nameMatch === 'mismatch') score -= 15;
    else if (r.nameMatch === 'similar') score -= 8;
    else if (r.nameMatch === 'variant') score -= 2;
  }
  for (const r of otherResults) {
    if (r.nameMatch === 'mismatch') score -= 5;
    else if (r.nameMatch === 'variant') score -= 1;
  }

  return Math.max(0, score);
}
```

### Knowledge Panel Timeline Estimator
```typescript
// lib/brand/entity-graph-builder.ts

export interface KPTimelineEstimate {
  rangeLabel: string;   // Human-readable range
  minWeeks: number;
  maxWeeks: number | null;  // null = "unlikely without more signals"
  conditions: string[];
  blockingIssues: string[];
}

export function estimateKPTimeline(identity: BrandIdentity): KPTimelineEstimate {
  const hasWikipedia = !!identity.wikipediaUrl;
  const hasWikidata = !!identity.wikidataQId;
  const hasGBP = identity.entityType === 'local_business';
  const sameAsScore = computeSameAsScore(identity.sameAsUrls).score;
  const isEstablished = (identity.kgConfidenceScore ?? 0) > 400;

  if (hasWikipedia && isEstablished && sameAsScore > 70) {
    return { rangeLabel: '1–4 weeks', minWeeks: 1, maxWeeks: 4, conditions: ['Wikipedia article present', 'High KG confidence', 'Strong sameAs graph'], blockingIssues: [] };
  }
  if (hasWikidata && sameAsScore > 50) {
    return { rangeLabel: '1–3 months', minWeeks: 4, maxWeeks: 12, conditions: ['Wikidata entry present', 'Multiple sameAs profiles'], blockingIssues: [] };
  }
  if (hasGBP && sameAsScore > 30) {
    return { rangeLabel: '2–4 weeks (local only)', minWeeks: 2, maxWeeks: 4, conditions: ['Google Business Profile verified', 'NAP consistent'], blockingIssues: [] };
  }
  return {
    rangeLabel: 'Unlikely without more signals',
    minWeeks: 0,
    maxWeeks: null,
    conditions: [],
    blockingIssues: [
      !hasWikidata ? 'Create a Wikidata entry' : '',
      sameAsScore < 30 ? 'Add high-value sameAs profiles (LinkedIn, Crunchbase)' : '',
      'Build independent press coverage (minimum 3 established publications)',
    ].filter(Boolean),
  };
}
```
</code_examples>

<sota_updates>
## State of the Art (2025–2026)

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| NAP consistency for local SEO only | Entity consistency for AI search (all platforms, all name variants) | 2025–2026 | 78% higher AI citation rates at 95%+ consistency |
| Schema markup = rich results | Schema markup = entity graph (`@id` + `sameAs`) for Knowledge Panel | 2024–2025 | Without `@id`, schema doesn't trigger Knowledge Panels |
| Wikipedia required for Knowledge Panel | Wikidata as primary signal (Wikipedia still helps but not required) | 2024 | Wikipedia has high notability bar; Wikidata is achievable for most businesses |
| Brand monitoring = paid SaaS | Free API polling (NewsData, GNews, Guardian, GDELT) + Google Alerts RSS | Ongoing | Adequate for SMB brand monitoring at zero cost |
| Single entity confidence score | Multi-source corroboration as the real signal | 2025–2026 | Google needs consensus across authoritative sources — one strong signal is not enough |
| Knowledge Panel = vanity metric | Knowledge Panel = AI citation feed | 2025–2026 | ChatGPT, Perplexity, Claude all use Knowledge Graph entity data for grounding |
| Wikipedia article = brand marketing | Wikidata entry = machine-readable entity record | 2024–2025 | Wikidata has structured properties that LLMs parse directly; Wikipedia is narrative |
| sameAs = any social URL | sameAs = prioritised entity signal list | 2025 | Order matters; Wikidata/Wikipedia must come first |

**New patterns (2025–2026):**
- **Entity disambiguation engineering:** Brands with common names must build extra disambiguation signals (unique URL as `@id`, KGMID cross-reference on Wikidata, detailed description on all profiles)
- **Closed entity loop:** Wikidata → points to website (P856) + official URL; Website → sameAs includes Wikidata Q-URL. This bidirectional link is what Google calls a "closed loop" and weights heavily.
- **Reference diversity on Wikidata:** Multiple independent sources per claim is critical. A Wikidata entry with a single reference source is nearly as weak as no entry — Google wants corroboration from at least 2–3 independent domains per key claim.
- **KGMID as primary identifier:** Once confirmed, always query Google KG API by KGMID (`/g/xxxxxxxx`) rather than name — eliminates disambiguation failures for common brand names.
</sota_updates>

<open_questions>
## Open Questions

1. **Automated sameAs URL verification**
   - What we know: sameAs URLs become stale when users change handles; stale URLs hurt KP signals
   - What's unclear: Whether head-checking sameAs URLs (HTTP 200 vs 404) is sufficient or if the content must also be verified
   - Recommendation: Phase 91 Plan 1 — verify HTTP status only (fast, no scraping); flag 4xx responses as action items. Full content verification is Phase 92+ scope.

2. **Mention sentiment analysis**
   - What we know: NewsData.io and GDELT provide sentiment data in some responses; Guardian does not
   - What's unclear: Whether API-provided sentiment is reliable enough to act on, or if a lightweight in-house heuristic (keyword-based) is better
   - Recommendation: Use API sentiment where provided; fall back to simple positive/negative keyword list for Guardian/GNews results. Do not call an LLM for sentiment — too expensive per-mention.

3. **Wikidata submission automation**
   - What we know: Wikidata has an edit API, but conflict-of-interest rules make auto-submission risky
   - What's unclear: Whether a verified-user flow (user authenticates with their own Wikidata account) would be acceptable
   - Recommendation: Phase 91 — generate structured checklist only, no auto-submission. Phase 92+ could explore user-authenticated Wikidata editing if there is demand.

4. **Per-platform handle extraction**
   - What we know: To check consistency, the system needs to read the brand's name as it appears on each sameAs platform
   - What's unclear: Whether scraping/fetching sameAs page titles is permissible at scale, or if a meta-tag HEAD request is sufficient
   - Recommendation: For Phase 91, generate a structured checklist for the user to complete manually (self-reported consistency check). Automated verification (HEAD request for Open Graph title) can be added in Plan 2 if there is no rate-limiting concern.

5. **Brand calendar integration with existing Campaign/Post models**
   - What we know: Synthex has existing Campaign and Post models; the brand calendar generates publishing recommendations
   - What's unclear: Whether brand calendar entries should create actual Campaign records or remain as advisory data
   - Recommendation: Phase 91 generates calendar JSON only — the user can manually create campaigns from recommendations. Auto-creation of Campaign records from calendar is deferred to Phase 92.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence — verified 2026)
- schemavalidator.org (Feb 2026): Knowledge Panel trigger signals table — Schema, Wikidata, NAP weights; `@id` + `sameAs` pattern; sameAs priority by platform; timeline expectations by scenario
- blitzmetrics.com (Feb 2026, Dennis Yu): Wikidata SOP with real before/after KGMID data — entity gap concept, reference diversity requirement, closed-loop `@id` + Wikidata pattern, KGMID as primary identifier
- aruntastic.com (Dec 2025): Wikidata notability criteria — three qualification paths, property list for Org vs Person entities, step-by-step creation process, Wikidata vs Wikipedia comparison for AI visibility
- seoengine.ai (Jan 2026): Cross-platform entity consistency — 78% citation rate improvement at 95%+ consistency; fragmentation into separate KG nodes from name variants
- toolpod.dev (2026): Free news API comparison — limits, data quality, use cases for NewsData.io, GNews, The Guardian, GDELT, Guardian Open Platform

### Secondary (MEDIUM confidence — industry studies)
- quolity.ai: AI citation pattern analysis — ChatGPT vs Grok vs Perplexity citation rates; entity-based citation selection
- cubitrek.com (Dec 2025): Disambiguation engineering — sameAs protocol for name collision resolution in LLMs
- govisible.ai (Jul 2025): Entity disambiguation failure modes — LLM brand misidentification root causes
- erlin.ai (Jun 2025): Brand visibility AI search signals — 150+ ecommerce site analysis; structured data as prerequisite for AI citation

### Tertiary (Foundational reference)
- schema.org Person, Organization, LocalBusiness specification — property definitions
- Wikidata notability guidelines — official criteria for item inclusion
- Google Knowledge Graph Search API documentation — entity search endpoint, response format, rate limits
- GDELT Project documentation — DOC API v2 endpoint, query format, free access terms
- Existing `lib/seo/schema-markup-service.ts` — current schema generation architecture to extend, not replace
- Existing `AuthorProfile` Prisma model (schema.prisma lines 2380–2410) — existing sameAs, credentials, eeatScore patterns to align with

### Codebase Sources (Verified by reading)
- `D:\Synthex\lib\seo\schema-markup-service.ts` — Person, Organization, LocalBusiness templates and `sameAs` array already supported; missing: `@id` entity graph pattern, `foundingDate`, `numberOfEmployees`, `address` on Organization. Phase 91 extends this service, does not replace it.
- `D:\Synthex\prisma\schema.prisma` lines 2380–2410 (`AuthorProfile`) — `sameAsUrls[]`, `credentials Json?` (array of credential objects), `eeatScore Float?` already exist. `BrandIdentity` is the org-level complement; `BrandCredential` replaces the unstructured `credentials Json?` for richer querying.
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: JSON-LD entity graph, Knowledge Panel triggers, Wikidata entity structure
- APIs: NewsData.io, GNews, The Guardian Open Platform, GDELT, Google KG Search API, Wikidata REST
- Patterns: sameAs priority, NAP consistency scoring, mention deduplication, KP timeline estimation
- Models: BrandIdentity, BrandCredential, BrandMention (+ existing AuthorProfile relationship)
- Pitfalls: Canonical name drift, stale sameAs, rate limit pooling, entity disambiguation, Wikidata editing norms

**Confidence breakdown:**
- Knowledge Panel triggers: HIGH — cross-validated across 4+ recent industry sources (Feb 2026)
- sameAs priority list: HIGH — consistent across multiple sources; Wikidata > Wikipedia > LinkedIn > Crunchbase
- API free tiers: HIGH — verified against current documentation for NewsData, GNews, Guardian, GDELT
- 78% citation rate improvement stat: MEDIUM — industry study (SEOEngine.ai), not peer-reviewed
- Wikidata property recommendations: HIGH — official Wikidata documentation + practitioner case studies
- KP timeline estimates: MEDIUM — practitioner reports; varies significantly by entity and niche

**Research date:** 2026-03-11
**Valid until:** 2026-09-11 (180 days — Knowledge Panel signals evolve slowly; API limits may change)

**Existing code to extend (not replace):**
- `lib/seo/schema-markup-service.ts` — add `buildEntityGraph()` function alongside existing templates
- `prisma/schema.prisma` `AuthorProfile` — `BrandIdentity` is the org-level complement; relate the two
- `lib/geo/feature-limits.ts` — add brand feature keys following existing pattern
</metadata>

---

*Phase: 91-brand-builder*
*Research completed: 2026-03-11*
*Ready for planning: yes*
