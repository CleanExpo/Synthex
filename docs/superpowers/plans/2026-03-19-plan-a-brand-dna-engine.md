# Brand DNA Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Brand DNA Engine — a persistent brand profile extracted automatically from a client's URL that powers all AI content generation downstream.

**Architecture:** Wrap the existing `lib/ai/onboarding-pipeline.ts` (which already extracts brand signals) in a new persistence layer. A `BrandDNA` Prisma model (1:1 with Organization) stores the structured profile. A new `POST /api/brand-dna/extract` endpoint returns an instant post preview (≤3s) while the full pipeline runs and persists in background. The existing brand-profile settings page is wired to this model as the source of truth.

**Tech Stack:** Next.js 15 App Router · Prisma 6 · PostgreSQL (Supabase) · Zod · existing `lib/ai/onboarding-pipeline.ts` · Jest (unit tests)

**Spec:** `docs/superpowers/specs/2026-03-18-v11-dual-surface-design.md` §1

**Linear issue:** Create SYN-411 before starting — "feat(brand-dna): Brand DNA Engine — Phase A v11.0"

---

## File Map

| Action | Path                                          | Responsibility                                                  |
| ------ | --------------------------------------------- | --------------------------------------------------------------- |
| Modify | `prisma/schema.prisma`                        | Add `BrandDNA` model + streak/timezone fields on `Organization` |
| Create | `lib/brand-dna/types.ts`                      | TypeScript interfaces for BrandDNA                              |
| Create | `lib/brand-dna/extractor.ts`                  | Runs pipeline, maps to BrandDNA shape, persists                 |
| Create | `lib/brand-dna/post-preview.ts`               | Generates instant post preview from partial URL data            |
| Create | `app/api/brand-dna/extract/route.ts`          | POST — instant preview + kicks off full extraction              |
| Create | `app/api/brand-dna/[organizationId]/route.ts` | GET — current BrandDNA for org                                  |
| Create | `app/api/brand-dna/refresh/route.ts`          | POST — re-runs extraction for org                               |
| Modify | `components/settings/brand-profile-tab.tsx`   | Wire to BrandDNA API instead of ad-hoc fields                   |
| Create | `tests/unit/api/brand-dna.test.ts`            | Unit tests for all three API routes                             |

---

## Task 1 — Schema: Add BrandDNA model

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `BrandDNA` model to schema**

Open `prisma/schema.prisma`. After the last model definition, append:

```prisma
model BrandDNA {
  id              String   @id @default(cuid())
  organizationId  String   @unique
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Identity
  businessName    String
  vertical        String   @default("other") // café | tradie | salon | gym | other
  industry        String   @default("")

  // Brand assets
  logoUrl         String?
  primaryColour   String?
  secondaryColour String?
  neutralColour   String?

  // Voice & persona (stored as JSON)
  brandVoice      Json     @default("{}")
  // Shape: { formality: 1-5, boldness: 1-5, tone: string, samplePhrases: string[] }

  persona         Json     @default("{}")
  // Shape: { ageRange: string, values: string[], painPoints: string[], description: string }

  offerings       Json     @default("[]")
  // Shape: string[]

  socialProfiles  Json     @default("[]")
  // Shape: { platform: string, url: string, verified: boolean }[]

  seoScore        Int?

  // Pipeline metadata
  sourceUrl       String
  extractedAt     DateTime @default(now())
  lastRefreshedAt DateTime @default(now())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId])
}
```

Also add inside `model Organization { ... }` (after the `favicon` field):

```prisma
  // Brand DNA relation
  brandDna        BrandDNA?

  // Stickiness — streak tracking
  streakCount     Int      @default(0)
  lastApprovedAt  DateTime?
  longestStreak   Int      @default(0)
  timezone        String   @default("Australia/Sydney")
```

- [ ] **Step 2: Validate schema**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 3: Push schema to database**

```bash
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add BrandDNA model + streak fields on Organization — SYN-411"
```

---

## Task 2 — Types: `lib/brand-dna/types.ts`

**Files:**

- Create: `lib/brand-dna/types.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/brand-dna/types.ts
// TypeScript interfaces for the Brand DNA system.
// These mirror the Prisma BrandDNA model but are safe to use in client components.

export interface BrandVoice {
  formality: 1 | 2 | 3 | 4 | 5; // 1 = very casual, 5 = very formal
  boldness: 1 | 2 | 3 | 4 | 5; // 1 = reserved, 5 = bold
  tone: string; // e.g. "friendly and approachable"
  samplePhrases: string[];
}

export interface BrandPersona {
  ageRange: string; // e.g. "25-45"
  values: string[]; // e.g. ["quality", "convenience"]
  painPoints: string[]; // e.g. ["no time for social media"]
  description: string;
}

export interface BrandSocialProfile {
  platform: string;
  url: string;
  verified: boolean;
}

export interface BrandDNARecord {
  id: string;
  organizationId: string;
  businessName: string;
  vertical: string;
  industry: string;
  logoUrl: string | null;
  primaryColour: string | null;
  secondaryColour: string | null;
  neutralColour: string | null;
  brandVoice: BrandVoice;
  persona: BrandPersona;
  offerings: string[];
  socialProfiles: BrandSocialProfile[];
  seoScore: number | null;
  sourceUrl: string;
  extractedAt: string;
  lastRefreshedAt: string;
}

// Returned by the instant-preview path (≤3s)
export interface BrandDNAPreview {
  businessName: string;
  industry: string;
  firstPost: string; // AI-generated post content
}

export interface ExtractResponse {
  preview: BrandDNAPreview;
  status: 'extracting'; // full pipeline still running
}

export interface BrandDNAResponse {
  brandDna: BrandDNARecord;
  status: 'complete';
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/brand-dna/types.ts
git commit -m "feat(brand-dna): add BrandDNA TypeScript types — SYN-411"
```

---

## Task 3 — Post Preview: `lib/brand-dna/post-preview.ts`

Generates the instant first post from minimal scraped data (before full pipeline completes).

**Files:**

- Create: `lib/brand-dna/post-preview.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lib/brand-dna-post-preview.test.ts`:

```typescript
import { generateInstantPostPreview } from '@/lib/brand-dna/post-preview';

describe('generateInstantPostPreview', () => {
  it('returns a non-empty string given minimal business info', async () => {
    const result = await generateInstantPostPreview({
      businessName: "Jake's Café",
      industry: 'café',
      heroCopy: 'Best coffee in Melbourne',
    });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(20);
  });

  it('falls back gracefully when AI key is missing', async () => {
    const original = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const result = await generateInstantPostPreview({
      businessName: 'Test Biz',
      industry: 'retail',
      heroCopy: '',
    });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    process.env.OPENROUTER_API_KEY = original;
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest tests/unit/lib/brand-dna-post-preview.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/brand-dna/post-preview'`

- [ ] **Step 3: Implement**

Create `lib/brand-dna/post-preview.ts`:

```typescript
// lib/brand-dna/post-preview.ts
// Generates an instant AI post preview from minimal website data (≤3s path).
// Falls back to a template if AI is unavailable.

import { logger } from '@/lib/logger';

export interface PreviewInput {
  businessName: string;
  industry: string;
  heroCopy: string;
}

const FALLBACK_TEMPLATES = [
  (b: string) => `${b} — where every detail matters. Come see us today.`,
  (b: string) => `Big things happening at ${b}! Follow along for updates.`,
  (b: string) => `Your local ${b} — quality you can count on. Visit us soon.`,
];

export async function generateInstantPostPreview(
  input: PreviewInput
): Promise<string> {
  const { businessName, industry, heroCopy } = input;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    logger.warn('[post-preview] No API key — using fallback template');
    const template =
      FALLBACK_TEMPLATES[Math.floor(Math.random() * FALLBACK_TEMPLATES.length)];
    return template(businessName);
  }

  try {
    const prompt = [
      `Write a single short social media post (max 2 sentences, under 180 characters) for "${businessName}", a ${industry} business.`,
      heroCopy ? `Their website says: "${heroCopy.slice(0, 200)}"` : '',
      'Be warm, local, and specific. No hashtags. No emojis unless natural. Write in Australian English.',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://synthex.social',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 100,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(4000), // hard 4s limit for instant path
      }
    );

    if (!response.ok) throw new Error(`OpenRouter ${response.status}`);
    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    return (
      data.choices[0]?.message?.content?.trim() ??
      FALLBACK_TEMPLATES[0](businessName)
    );
  } catch (error) {
    logger.warn(
      '[post-preview] AI generation failed, using fallback',
      error instanceof Error ? error : undefined
    );
    return FALLBACK_TEMPLATES[0](businessName);
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/lib/brand-dna-post-preview.test.ts --no-coverage
```

Expected: PASS (2 tests) — Note: test 1 may call real API if key is present in env; mock if needed.

- [ ] **Step 5: Commit**

```bash
git add lib/brand-dna/post-preview.ts tests/unit/lib/brand-dna-post-preview.test.ts
git commit -m "feat(brand-dna): instant post preview generator with AI + fallback — SYN-411"
```

---

## Task 4 — Extractor: `lib/brand-dna/extractor.ts`

Maps `PipelineResult` → `BrandDNA` Prisma record.

**Files:**

- Create: `lib/brand-dna/extractor.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lib/brand-dna-extractor.test.ts`:

```typescript
import { mapPipelineResultToBrandDNA } from '@/lib/brand-dna/extractor';
import type { PipelineResult } from '@/lib/ai/onboarding-pipeline';

const mockPipeline: PipelineResult = {
  businessName: "Jake's Café",
  industry: 'Food & Beverage',
  description: 'A cosy café in Melbourne',
  teamSize: '1-5',
  logoUrl: 'https://jakes.com/logo.png',
  faviconUrl: null,
  brandColours: { primary: '#3b2f1e', secondary: '#d4a96a' },
  seoSignals: null,
  seoScore: 72,
  pageSpeed: { mobile: null, desktop: null },
  overallHealth: 'good',
  healthSummary: 'Good',
  quickWins: [],
  contentGaps: [],
  keywordOpportunities: [],
  socialProfiles: [
    {
      platform: 'instagram',
      url: 'https://instagram.com/jakescafe',
      verified: true,
    },
  ],
  socialHandles: { instagram: '@jakescafe' },
  keyTopics: ['coffee', 'brunch', 'local'],
  targetAudience: 'Coffee lovers aged 25-45',
  suggestedTone: 'warm and friendly',
  suggestedPersonaName: 'The Regular',
  confidence: 0.9,
  structuredData: {},
  url: 'https://jakes-cafe.com.au',
};

describe('mapPipelineResultToBrandDNA', () => {
  it('maps pipeline result to BrandDNA shape correctly', () => {
    const result = mapPipelineResultToBrandDNA(mockPipeline, 'org_123');
    expect(result.organizationId).toBe('org_123');
    expect(result.businessName).toBe("Jake's Café");
    expect(result.primaryColour).toBe('#3b2f1e');
    expect(result.secondaryColour).toBe('#d4a96a');
    expect(result.seoScore).toBe(72);
    expect(result.socialProfiles).toHaveLength(1);
    expect(result.offerings).toEqual(['coffee', 'brunch', 'local']);
    expect(result.brandVoice.tone).toBe('warm and friendly');
    expect(result.persona.description).toBe('Coffee lovers aged 25-45');
    expect(result.vertical).toBe('café');
    expect(result.sourceUrl).toBe('https://jakes-cafe.com.au');
  });

  it('infers vertical from industry string', () => {
    const result = mapPipelineResultToBrandDNA(
      { ...mockPipeline, industry: 'Hair Salon' },
      'org_x'
    );
    expect(result.vertical).toBe('salon');
  });
});
```

- [ ] **Step 2: Run test to confirm fail**

```bash
npx jest tests/unit/lib/brand-dna-extractor.test.ts --no-coverage
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `lib/brand-dna/extractor.ts`:

```typescript
// lib/brand-dna/extractor.ts
// Maps PipelineResult → BrandDNA Prisma upsert payload.
// Also handles full extract-and-persist flow.

import { prisma } from '@/lib/prisma';
import {
  runOnboardingPipeline,
  type PipelineResult,
} from '@/lib/ai/onboarding-pipeline';
import { logger } from '@/lib/logger';
import type { BrandVoice, BrandPersona, BrandSocialProfile } from './types';

// Infer vertical from industry string
function inferVertical(industry: string): string {
  const lower = industry.toLowerCase();
  if (
    lower.includes('café') ||
    lower.includes('cafe') ||
    lower.includes('coffee') ||
    lower.includes('food') ||
    lower.includes('restaurant')
  )
    return 'café';
  if (
    lower.includes('hair') ||
    lower.includes('salon') ||
    lower.includes('beauty') ||
    lower.includes('nail')
  )
    return 'salon';
  if (
    lower.includes('gym') ||
    lower.includes('fitness') ||
    lower.includes('sport') ||
    lower.includes('health')
  )
    return 'gym';
  if (
    lower.includes('trade') ||
    lower.includes('plumb') ||
    lower.includes('electr') ||
    lower.includes('build') ||
    lower.includes('construct')
  )
    return 'tradie';
  return 'other';
}

export interface BrandDNAUpsertPayload {
  organizationId: string;
  businessName: string;
  vertical: string;
  industry: string;
  logoUrl: string | null;
  primaryColour: string | null;
  secondaryColour: string | null;
  neutralColour: string | null;
  brandVoice: BrandVoice;
  persona: BrandPersona;
  offerings: string[];
  socialProfiles: BrandSocialProfile[];
  seoScore: number | null;
  sourceUrl: string;
}

export function mapPipelineResultToBrandDNA(
  result: PipelineResult,
  organizationId: string
): BrandDNAUpsertPayload {
  return {
    organizationId,
    businessName: result.businessName,
    vertical: inferVertical(result.industry),
    industry: result.industry,
    logoUrl: result.logoUrl,
    primaryColour: result.brandColours?.primary ?? null,
    secondaryColour: result.brandColours?.secondary ?? null,
    neutralColour: null, // not in pipeline output — left for user to set
    brandVoice: {
      formality: 2, // default casual — pipeline doesn't score this yet
      boldness: 3,
      tone: result.suggestedTone || 'friendly and approachable',
      samplePhrases: [],
    },
    persona: {
      ageRange: '',
      values: [],
      painPoints: [],
      description: result.targetAudience || '',
    },
    offerings: result.keyTopics ?? [],
    socialProfiles: (result.socialProfiles ?? []).map(p => ({
      platform: p.platform,
      url: p.url,
      verified: p.verified,
    })),
    seoScore: result.seoScore ?? null,
    sourceUrl: result.url,
  };
}

/**
 * Full extraction: runs pipeline + persists BrandDNA.
 * Call this in background after returning the instant preview.
 */
export async function extractAndPersistBrandDNA(
  url: string,
  businessName: string,
  organizationId: string
): Promise<void> {
  try {
    const pipelineResult = await runOnboardingPipeline({ url, businessName });
    const payload = mapPipelineResultToBrandDNA(pipelineResult, organizationId);

    await prisma.brandDNA.upsert({
      where: { organizationId },
      create: { ...payload, lastRefreshedAt: new Date() },
      update: { ...payload, lastRefreshedAt: new Date() },
    });

    logger.info(
      `[brand-dna] Extracted and persisted for org ${organizationId}`
    );
  } catch (error) {
    logger.error(
      '[brand-dna] Full extraction failed',
      error instanceof Error ? error : undefined
    );
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/lib/brand-dna-extractor.test.ts --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/brand-dna/extractor.ts tests/unit/lib/brand-dna-extractor.test.ts
git commit -m "feat(brand-dna): pipeline mapper + persist extractor — SYN-411"
```

---

## Task 5 — API: Extract endpoint

**Files:**

- Create: `app/api/brand-dna/extract/route.ts`
- Create: `tests/unit/api/brand-dna.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/api/brand-dna.test.ts`:

```typescript
import { POST } from '@/app/api/brand-dna/extract/route';
import { NextRequest } from 'next/server';

// Mock auth
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: jest.fn().mockResolvedValue('user-123'),
  unauthorizedResponse: jest.fn(
    () => new Response('Unauthorized', { status: 401 })
  ),
}));

// Mock business scope
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: jest.fn().mockResolvedValue('org-123'),
}));

// Mock extractor (don't hit real AI or DB)
jest.mock('@/lib/brand-dna/extractor', () => ({
  extractAndPersistBrandDNA: jest.fn().mockResolvedValue(undefined),
}));

// Mock post preview
jest.mock('@/lib/brand-dna/post-preview', () => ({
  generateInstantPostPreview: jest
    .fn()
    .mockResolvedValue("Test post for Jake's Café"),
}));

// Mock website partial scrape (for business name)
jest.mock('@/lib/ai/website-analyzer', () => ({
  analyzeWebsite: jest.fn().mockResolvedValue({
    businessName: "Jake's Café",
    industry: 'café',
    heroCopy: 'Best coffee in Melbourne',
  }),
}));

describe('POST /api/brand-dna/extract', () => {
  it('returns 400 for missing url', async () => {
    const req = new NextRequest('http://localhost/api/brand-dna/extract', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 with preview and extracting status', async () => {
    const req = new NextRequest('http://localhost/api/brand-dna/extract', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://jakes-cafe.com.au' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('extracting');
    expect(data.preview.firstPost).toBeTruthy();
  });

  it('returns 401 when unauthenticated', async () => {
    const { getUserIdFromRequestOrCookies } = require('@/lib/auth/jwt-utils');
    getUserIdFromRequestOrCookies.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/brand-dna/extract', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to confirm fail**

```bash
npx jest tests/unit/api/brand-dna.test.ts --no-coverage
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement the route**

Create `app/api/brand-dna/extract/route.ts`:

```typescript
/**
 * POST /api/brand-dna/extract
 *
 * Instant preview path (≤3s): fetches business name + generates first post.
 * Full pipeline runs in background and persists to BrandDNA model.
 *
 * Body: { url: string }
 * Returns: { preview: BrandDNAPreview, status: 'extracting' }
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { generateInstantPostPreview } from '@/lib/brand-dna/post-preview';
import { extractAndPersistBrandDNA } from '@/lib/brand-dna/extractor';
import { analyzeWebsite } from '@/lib/ai/website-analyzer';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const ExtractSchema = z.object({
  url: z.string().url('Must be a valid URL'),
});

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(req);
  if (!userId) return unauthorizedResponse();

  const orgId = await getEffectiveOrganizationId(userId);
  if (!orgId) {
    return NextResponse.json(
      { error: 'No active organisation' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = ExtractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { url } = parsed.data;

  // --- Instant preview path (≤3s) ---
  let businessName = 'your business';
  let industry = 'business';
  let heroCopy = '';

  try {
    const partial = await analyzeWebsite({ url, businessName: '' });
    businessName = partial?.businessName || businessName;
    industry = partial?.industry || industry;
    heroCopy = (partial as { heroCopy?: string })?.heroCopy || '';
  } catch (err) {
    logger.warn(
      '[brand-dna/extract] Partial scrape failed, using defaults',
      err instanceof Error ? err : undefined
    );
  }

  const firstPost = await generateInstantPostPreview({
    businessName,
    industry,
    heroCopy,
  });

  // --- Fire full extraction in background (don't await) ---
  extractAndPersistBrandDNA(url, businessName, orgId).catch(err => {
    logger.error(
      '[brand-dna/extract] Background extraction failed',
      err instanceof Error ? err : undefined
    );
  });

  return NextResponse.json({
    preview: { businessName, industry, firstPost },
    status: 'extracting',
  });
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/api/brand-dna.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/brand-dna/extract/route.ts tests/unit/api/brand-dna.test.ts
git commit -m "feat(brand-dna): POST /api/brand-dna/extract — instant preview + background pipeline — SYN-411"
```

---

## Task 6 — API: GET current BrandDNA + POST refresh

**Files:**

- Create: `app/api/brand-dna/[organizationId]/route.ts`
- Create: `app/api/brand-dna/refresh/route.ts`

- [ ] **Step 1: Implement GET**

Create `app/api/brand-dna/[organizationId]/route.ts`:

```typescript
/**
 * GET /api/brand-dna/[organizationId]
 * Returns the current BrandDNA for an organisation.
 * Returns 404 if not yet extracted.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { organizationId: string } }
) {
  const userId = await getUserIdFromRequestOrCookies(req);
  if (!userId) return unauthorizedResponse();

  // Ensure user can only access their own org's DNA
  const orgId = await getEffectiveOrganizationId(userId);
  if (!orgId || orgId !== params.organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const brandDna = await prisma.brandDNA.findUnique({
    where: { organizationId: orgId },
  });

  if (!brandDna) {
    return NextResponse.json(
      { error: 'Brand DNA not yet extracted' },
      { status: 404 }
    );
  }

  return NextResponse.json({ brandDna, status: 'complete' });
}
```

- [ ] **Step 2: Implement POST refresh**

Create `app/api/brand-dna/refresh/route.ts`:

```typescript
/**
 * POST /api/brand-dna/refresh
 * Triggers a full re-extraction from the stored sourceUrl.
 * Returns 202 Accepted immediately; extraction runs in background.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { extractAndPersistBrandDNA } from '@/lib/brand-dna/extractor';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(req);
  if (!userId) return unauthorizedResponse();

  const orgId = await getEffectiveOrganizationId(userId);
  if (!orgId) {
    return NextResponse.json(
      { error: 'No active organisation' },
      { status: 403 }
    );
  }

  const existing = await prisma.brandDNA.findUnique({
    where: { organizationId: orgId },
    select: { sourceUrl: true, businessName: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: 'No Brand DNA found — run /extract first' },
      { status: 404 }
    );
  }

  extractAndPersistBrandDNA(
    existing.sourceUrl,
    existing.businessName,
    orgId
  ).catch(err => {
    logger.error(
      '[brand-dna/refresh] Background re-extraction failed',
      err instanceof Error ? err : undefined
    );
  });

  return NextResponse.json(
    { status: 'refreshing', message: 'Re-extraction started' },
    { status: 202 }
  );
}
```

- [ ] **Step 3: Run full pre-PR gate**

```bash
npm run type-check && npm run lint
```

Expected: 0 errors, 0 warnings

- [ ] **Step 4: Commit**

```bash
git add app/api/brand-dna/[organizationId]/route.ts app/api/brand-dna/refresh/route.ts
git commit -m "feat(brand-dna): GET /api/brand-dna/[orgId] + POST /api/brand-dna/refresh — SYN-411"
```

---

## Task 7 — Wire Brand Profile settings page to BrandDNA

**Files:**

- Modify: `components/settings/brand-profile-tab.tsx`

- [ ] **Step 1: Read the current component**

```bash
cat components/settings/brand-profile-tab.tsx | head -60
```

Note the current data-fetching pattern and form fields.

- [ ] **Step 2: Update data source**

Replace the existing data-fetch with `useSWR` pointing to `/api/brand-dna/${orgId}`:

```typescript
// At the top of the component (after existing imports):
import useSWR from 'swr';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';

// Inside the component:
const { activeOrganizationId } = useActiveBusiness();
const { data, isLoading } = useSWR(
  activeOrganizationId ? `/api/brand-dna/${activeOrganizationId}` : null,
  (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json())
);
const brandDna = data?.brandDna;
```

Update form field defaults to read from `brandDna.*` fields instead of their current source.

Add a "Refresh Brand Profile" button that calls `POST /api/brand-dna/refresh`:

```typescript
const handleRefresh = async () => {
  await fetch('/api/brand-dna/refresh', {
    method: 'POST',
    credentials: 'include',
  });
  toast.success('Brand profile refresh started — check back in 30 seconds');
};
```

- [ ] **Step 3: Run pre-PR gate**

```bash
npm run type-check && npm test -- --testPathPattern=brand-dna --no-coverage
```

Expected: type-check clean, brand-dna tests pass

- [ ] **Step 4: Commit**

```bash
git add components/settings/brand-profile-tab.tsx
git commit -m "feat(brand-dna): wire brand-profile settings to BrandDNA API — SYN-411"
```

---

## Task 8 — Final verification

- [ ] **Run full test suite**

```bash
npm test -- --no-coverage 2>&1 | tail -10
```

Expected: All tests pass, no regressions

- [ ] **Run full pre-PR gate**

```bash
npm run type-check && npm run lint && npm test -- --no-coverage 2>&1 | tail -5
```

Expected: 0 errors, 0 warnings, all tests pass

- [ ] **Update Linear issue SYN-411** — add comment with files changed, set status to Done

- [ ] **Final commit if anything outstanding**

```bash
git status
# If clean: done. If not:
git add -p && git commit -m "feat(brand-dna): Brand DNA Engine complete — SYN-411"
```

---

## Wave 2 dependency note

Plans B (Onboarding Redesign) and C (Simple Mode Surface) both depend on this plan completing. Notify the orchestrator when Task 8 is complete so Wave 2 can launch.
