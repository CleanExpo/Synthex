# Generative Video Engine Implementation Plan (Plan 1 of 2: Engine + Tool Layer + MCP)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fal.ai-backed generative video engine for Synthex — card-composed prompts, quota-guarded async jobs, webhook completion into the media library, and a typed tool layer exposed over MCP.

**Architecture:** A single typed tool layer (`lib/services/ai/studio-tools/`) wraps a generation service (`lib/services/ai/video/`) that composes prompts from a data-driven card registry, holds org quota, submits to fal.ai's queue, and persists `VideoGeneration` rows; a webhook route completes jobs into Supabase storage + media library. REST routes, MCP, and (in Plan 2) the studio UI/copilot are thin wrappers over the same tools.

**Tech Stack:** Next.js 16 App Router (`app/api/*` route handlers), Prisma 7 (`@/lib/prisma`), zod v4, jest 29 (`npm test` → `jest --config jest.worktree.cjs`, tests in `__tests__/<area>/*.test.ts`), Supabase storage via `mediaLibraryService`, fal.ai queue API, `mcp-handler` for the MCP endpoint.

**Spec:** `docs/superpowers/specs/2026-06-11-synthex-generative-video-design.md` (Approved 2026-06-11). Plan 2 (Studio UI + copilot rail) is written after this plan executes.

**Conventions used throughout (match the codebase):**

- Auth in routes: `APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE)` then `APISecurityChecker.createSecureResponse(body, status)` — copy the pattern from `app/api/video/generate/route.ts:66-77`.
- Org resolution: `getEffectiveOrganizationId(userId)` from `@/lib/multi-business/business-scope`.
- Prisma mocking in tests: `jest.mock('@/lib/prisma', () => ({ __esModule: true, default: { … } }))` — pattern from `__tests__/calendar/generateWeeklyCalendar.test.ts:26`.
- Logging: `import { logger } from '@/lib/logger'`.
- All money values are USD numbers rounded to 4 dp; never floats in Prisma — `Decimal` columns, `Number()` at the edge.

## File structure (what gets created)

```
lib/services/ai/video/
  types.ts               # request/job/model-spec types (no logic)
  registry.ts            # model catalog + resolveModel()
  cards/
    method-cards.ts      # 9 launch method cards (data)
    modifier-chips.ts    # launch chips: style/camera/lighting (data)
    brand-cards.ts       # brand card derivation from BrandDNA
    compose.ts           # composePrompt() — scaffold + subject + chips + brand
  quota.ts               # hold / settle / release, monthly+daily+MCP sub-cap
  fal-adapter.ts         # submit to fal queue, webhook token verify/parse
  generation-service.ts  # orchestration: quota → compose → submit → persist
  llm-routing.ts         # LLM_ROUTING task→model map
  prompt-enhancer.ts     # cheap-LLM prompt expansion (Freeform card)
lib/services/ai/studio-tools/
  index.ts               # typed tool registry + executeStudioTool()
app/api/video/webhook/fal/route.ts   # POST — fal completion webhook
app/api/video/cards/route.ts         # GET — card registry
app/api/video/generate/route.ts      # MODIFY — add mode:"generative" branch
app/api/cron/video-sweep/route.ts    # stale-job sweep
app/api/video/[id]/route.ts          # MODIFY — lazy fal status poll-through
app/api/mcp/[transport]/route.ts     # MCP server endpoint
prisma/schema.prisma                 # MODIFY — VideoGeneration cols + OrganizationVideoQuota
__tests__/video-engine/*.test.ts     # all tests for this plan
scripts/video-smoke-test.ts          # env-gated live smoke test
```

---

### Task 1: Prisma schema — extend `VideoGeneration`, add `OrganizationVideoQuota`

**Files:**

- Modify: `prisma/schema.prisma` (VideoGeneration model at ~line 3217; add new model after it)

- [ ] **Step 1: Add generative columns to `VideoGeneration`**

Inside `model VideoGeneration { … }`, after the existing `metadata Json?` line, insert:

```prisma
  // Generative-video extension (all nullable; legacy script rows unaffected)
  mode           String  @default("script") // 'script' | 'generative'
  provider       String? // 'fal'
  model          String? @map("gen_model") // e.g. 'fal-ai/wan-25'
  providerJobId  String? @map("provider_job_id")
  initiatedBy    String  @default("studio") @map("initiated_by") // 'studio' | 'copilot' | 'mcp'
  inputPrompt    String? @map("input_prompt")
  enhancedPrompt String? @map("enhanced_prompt")
  inputImageUrl  String? @map("input_image_url")
  methodCardId   String? @map("method_card_id")
  modifierIds    String[] @default([]) @map("modifier_ids")
  brandCardId    String? @map("brand_card_id")
  aspectRatio    String? @map("aspect_ratio") // '9:16' | '1:1' | '16:9'
  durationSeconds Int?   @map("duration_seconds")
  audioEnabled   Boolean @default(false) @map("audio_enabled")
  batchGroupId   String? @map("batch_group_id")
  seed           Int?
  estimatedCostUsd Decimal? @map("estimated_cost_usd") @db.Decimal(10, 4)
  actualCostUsd    Decimal? @map("actual_cost_usd") @db.Decimal(10, 4)
```

And add two indexes next to the existing `@@index` lines:

```prisma
  @@index([providerJobId])
  @@index([batchGroupId])
```

- [ ] **Step 2: Add the quota model**

Immediately after the `VideoGeneration` model's closing brace:

```prisma
model OrganizationVideoQuota {
  id              String   @id @default(cuid())
  organizationId  String   @unique @map("organization_id")
  monthlyBudgetUsd Decimal @default(25) @map("monthly_budget_usd") @db.Decimal(10, 4)
  dailyBudgetUsd   Decimal @default(5) @map("daily_budget_usd") @db.Decimal(10, 4)
  spentUsd         Decimal @default(0) @map("spent_usd") @db.Decimal(10, 4)
  spentTodayUsd    Decimal @default(0) @map("spent_today_usd") @db.Decimal(10, 4)
  spentTodayMcpUsd Decimal @default(0) @map("spent_today_mcp_usd") @db.Decimal(10, 4)
  periodStart      DateTime @default(now()) @map("period_start")
  dayStart         DateTime @default(now()) @map("day_start")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  organization Organization @relation("OrganizationVideoQuota", fields: [organizationId], references: [id], onDelete: Cascade)

  @@map("organization_video_quotas")
}
```

Then add the back-relation inside `model Organization` (find it with `grep -n "model Organization {" prisma/schema.prisma`), next to its other relation fields:

```prisma
  videoQuota OrganizationVideoQuota? @relation("OrganizationVideoQuota")
```

- [ ] **Step 3: Validate and generate**

Run: `cd D:\Synthex; npx prisma validate; npx prisma generate`
Expected: `The schema at prisma\schema.prisma is valid` and client generation succeeds.

- [ ] **Step 4: Create the migration (dev DB)**

Run: `npm run db:migrate:dev -- --name generative_video_engine`
Expected: migration created and applied. If no dev DB is reachable, run `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` to produce SQL and stop — flag for the human to apply (per repo DB discipline, do NOT push to prod from this plan).

- [ ] **Step 5: Type-check and commit**

Run: `npm run type-check`
Expected: PASS (no new errors).

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(video): schema for generative video jobs + org quota"
```

---

### Task 2: Model types + registry

**Files:**

- Create: `lib/services/ai/video/types.ts`
- Create: `lib/services/ai/video/registry.ts`
- Test: `__tests__/video-engine/registry.test.ts`

- [ ] **Step 1: Write `types.ts`**

```typescript
/**
 * Generative video engine — shared types.
 * Spec: docs/superpowers/specs/2026-06-11-synthex-generative-video-design.md
 */

export type ModelTier = 'draft' | 'standard' | 'premium';
export type AspectRatio = '9:16' | '1:1' | '16:9';
export type InitiatedBy = 'studio' | 'copilot' | 'mcp';

export interface VideoModelSpec {
  id: string; // fal endpoint id, e.g. 'fal-ai/wan/v2.5/text-to-video'
  name: string;
  provider: 'fal';
  tier: ModelTier;
  costPerSecondUsd: number;
  maxDurationSeconds: number;
  aspectRatios: AspectRatio[];
  supportsImageInput: boolean;
  supportsAudio: boolean;
  strengths: string[];
  weaknesses: string[];
  bestFor: string;
}

export interface GenerativeVideoRequest {
  userId: string;
  organizationId: string;
  initiatedBy: InitiatedBy;
  prompt: string; // the user's subject (fills {{subject}})
  imageUrl?: string; // I2V input
  methodCardId: string;
  modifierIds?: string[];
  brandCardId?: string; // organizationId of the brand to apply
  audio?: boolean;
  variants?: number; // 1-8, default 1
  modelTier?: ModelTier; // default 'draft'
  aspectRatio?: AspectRatio; // default '9:16'
  durationSeconds?: number; // default 6
}

export interface SubmittedJob {
  id: string; // VideoGeneration row id
  providerJobId: string;
  batchGroupId: string;
  model: string;
  estimatedCostUsd: number;
  status: 'generating';
}

export class QuotaExceededError extends Error {
  constructor(
    public readonly cap: 'monthly' | 'daily' | 'mcp-daily',
    public readonly limitUsd: number,
    public readonly spentUsd: number
  ) {
    super(
      `Video budget cap exceeded (${cap}): $${spentUsd.toFixed(2)} spent of $${limitUsd.toFixed(2)} limit`
    );
    this.name = 'QuotaExceededError';
  }
}
```

- [ ] **Step 2: Write the failing registry test**

`__tests__/video-engine/registry.test.ts`:

```typescript
import {
  VIDEO_MODELS,
  resolveModel,
  estimateCostUsd,
} from '@/lib/services/ai/video/registry';

describe('video model registry', () => {
  it('has at least one model per tier with a capability profile', () => {
    for (const tier of ['draft', 'standard', 'premium'] as const) {
      const models = VIDEO_MODELS.filter(m => m.tier === tier);
      expect(models.length).toBeGreaterThan(0);
      for (const m of models) {
        expect(m.strengths.length).toBeGreaterThan(0);
        expect(m.bestFor).toBeTruthy();
        expect(m.costPerSecondUsd).toBeGreaterThan(0);
      }
    }
  });

  it('resolves draft tier to the cheapest matching model', () => {
    const m = resolveModel('draft', {
      aspectRatio: '9:16',
      durationSeconds: 6,
    });
    expect(m.tier).toBe('draft');
    const draftCosts = VIDEO_MODELS.filter(x => x.tier === 'draft').map(
      x => x.costPerSecondUsd
    );
    expect(m.costPerSecondUsd).toBe(Math.min(...draftCosts));
  });

  it('routes audio-on requests to a supportsAudio model within the tier', () => {
    const m = resolveModel('premium', {
      aspectRatio: '16:9',
      durationSeconds: 6,
      audio: true,
    });
    expect(m.supportsAudio).toBe(true);
  });

  it('routes image-input requests to a supportsImageInput model', () => {
    const m = resolveModel('draft', {
      aspectRatio: '9:16',
      durationSeconds: 6,
      requiresImage: true,
    });
    expect(m.supportsImageInput).toBe(true);
  });

  it('throws a clear error when duration exceeds the tier maximum', () => {
    expect(() =>
      resolveModel('draft', { aspectRatio: '9:16', durationSeconds: 600 })
    ).toThrow(/duration/i);
  });

  it('estimates cost as duration x per-second rate', () => {
    const m = resolveModel('draft', {
      aspectRatio: '9:16',
      durationSeconds: 6,
    });
    expect(estimateCostUsd(m, 6)).toBeCloseTo(m.costPerSecondUsd * 6, 4);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- __tests__/video-engine/registry.test.ts`
Expected: FAIL — `Cannot find module '@/lib/services/ai/video/registry'`

- [ ] **Step 4: Write `registry.ts`**

```typescript
/**
 * Video model catalog + tier resolver.
 * Catalog is DATA — update entries as fal's lineup/pricing changes; never hardcode
 * model ids elsewhere. Pricing observed 2026-06 (fal.ai/pricing); verify at deploy.
 */
import { AspectRatio, ModelTier, VideoModelSpec } from './types';

export const VIDEO_MODELS: VideoModelSpec[] = [
  {
    id: 'fal-ai/wan/v2.5/text-to-video',
    name: 'Wan 2.5',
    provider: 'fal',
    tier: 'draft',
    costPerSecondUsd: 0.05,
    maxDurationSeconds: 10,
    aspectRatios: ['9:16', '1:1', '16:9'],
    supportsImageInput: false,
    supportsAudio: false,
    strengths: ['cheapest', 'fast queue', 'good composition/timing drafts'],
    weaknesses: ['weaker complex motion', 'no audio', 'no image input'],
    bestFor: 'iteration drafts and batch variant exploration',
  },
  {
    id: 'fal-ai/wan/v2.5/image-to-video',
    name: 'Wan 2.5 I2V',
    provider: 'fal',
    tier: 'draft',
    costPerSecondUsd: 0.05,
    maxDurationSeconds: 10,
    aspectRatios: ['9:16', '1:1', '16:9'],
    supportsImageInput: true,
    supportsAudio: false,
    strengths: ['cheapest image-to-video'],
    weaknesses: ['weaker complex motion', 'no audio'],
    bestFor: 'animating product stills cheaply',
  },
  {
    id: 'fal-ai/minimax/hailuo-2.3/text-to-video',
    name: 'MiniMax Hailuo 2.3',
    provider: 'fal',
    tier: 'standard',
    costPerSecondUsd: 0.25,
    maxDurationSeconds: 10,
    aspectRatios: ['9:16', '1:1', '16:9'],
    supportsImageInput: true,
    supportsAudio: false,
    strengths: ['strong human/subject motion', 'good prompt adherence'],
    weaknesses: ['no native audio', 'mid price'],
    bestFor: 'standard-quality social clips with people or products in motion',
  },
  {
    id: 'fal-ai/kling-video/v3/pro/text-to-video',
    name: 'Kling 3 Pro',
    provider: 'fal',
    tier: 'premium',
    costPerSecondUsd: 0.28,
    maxDurationSeconds: 10,
    aspectRatios: ['9:16', '1:1', '16:9'],
    supportsImageInput: true,
    supportsAudio: true,
    strengths: [
      'native audio + lip-sync',
      'strong realism',
      'price-leader at premium',
    ],
    weaknesses: ['queue can be slow at peak'],
    bestFor: 'finished product with dialogue/SFX at the lower premium price',
  },
  {
    id: 'fal-ai/veo3.1',
    name: 'Veo 3.1',
    provider: 'fal',
    tier: 'premium',
    costPerSecondUsd: 0.4,
    maxDurationSeconds: 8,
    aspectRatios: ['9:16', '16:9'],
    supportsImageInput: true,
    supportsAudio: true,
    strengths: ['best realism', 'native audio', 'cinematic lighting'],
    weaknesses: ['most expensive', 'no 1:1'],
    bestFor: 'hero/final assets where quality is the point',
  },
];

export interface ResolveOptions {
  aspectRatio: AspectRatio;
  durationSeconds: number;
  audio?: boolean;
  requiresImage?: boolean;
}

export function resolveModel(
  tier: ModelTier,
  opts: ResolveOptions
): VideoModelSpec {
  const candidates = VIDEO_MODELS.filter(
    m =>
      m.tier === tier &&
      m.aspectRatios.includes(opts.aspectRatio) &&
      (!opts.audio || m.supportsAudio) &&
      (!opts.requiresImage || m.supportsImageInput)
  );
  if (candidates.length === 0) {
    throw new Error(
      `No ${tier} model supports aspect=${opts.aspectRatio}` +
        `${opts.audio ? ' +audio' : ''}${opts.requiresImage ? ' +image' : ''}`
    );
  }
  const within = candidates.filter(
    m => opts.durationSeconds <= m.maxDurationSeconds
  );
  if (within.length === 0) {
    const max = Math.max(...candidates.map(m => m.maxDurationSeconds));
    throw new Error(
      `Requested duration ${opts.durationSeconds}s exceeds ${tier} tier maximum of ${max}s`
    );
  }
  // Cheapest matching model wins within a tier.
  return within.sort((a, b) => a.costPerSecondUsd - b.costPerSecondUsd)[0];
}

export function estimateCostUsd(
  model: VideoModelSpec,
  durationSeconds: number
): number {
  return Math.round(model.costPerSecondUsd * durationSeconds * 10000) / 10000;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- __tests__/video-engine/registry.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/services/ai/video/types.ts lib/services/ai/video/registry.ts __tests__/video-engine/registry.test.ts
git commit -m "feat(video): model types, capability-profiled registry, tier resolver"
```

---

### Task 3: Card registry — method cards, modifier chips, brand cards, composition

**Files:**

- Create: `lib/services/ai/video/cards/method-cards.ts`
- Create: `lib/services/ai/video/cards/modifier-chips.ts`
- Create: `lib/services/ai/video/cards/brand-cards.ts`
- Create: `lib/services/ai/video/cards/compose.ts`
- Test: `__tests__/video-engine/cards.test.ts`

- [ ] **Step 1: Write the failing test**

`__tests__/video-engine/cards.test.ts`:

```typescript
import {
  METHOD_CARDS,
  getMethodCard,
} from '@/lib/services/ai/video/cards/method-cards';
import {
  MODIFIER_CHIPS,
  getChips,
} from '@/lib/services/ai/video/cards/modifier-chips';
import { brandFragmentFromDna } from '@/lib/services/ai/video/cards/brand-cards';
import { composePrompt } from '@/lib/services/ai/video/cards/compose';

describe('card registry', () => {
  it('ships 9 method cards including freeform, each with a {{subject}} scaffold', () => {
    expect(METHOD_CARDS.length).toBe(9);
    expect(METHOD_CARDS.map(c => c.id)).toContain('freeform');
    for (const c of METHOD_CARDS.filter(c => c.id !== 'freeform')) {
      expect(c.promptScaffold).toContain('{{subject}}');
    }
  });

  it('ships chips across style, camera, lighting with camera the deepest', () => {
    const byCat = (cat: string) =>
      MODIFIER_CHIPS.filter(m => m.category === cat);
    expect(byCat('style').length).toBeGreaterThanOrEqual(4);
    expect(byCat('camera').length).toBeGreaterThanOrEqual(12);
    expect(byCat('lighting').length).toBeGreaterThanOrEqual(4);
  });

  it('composes scaffold + subject, then chips grouped by category order', () => {
    const out = composePrompt({
      methodCard: getMethodCard('product-reveal')!,
      subject: 'a cordless moisture meter',
      chips: getChips(['style-cinematic', 'camera-orbit']),
    });
    expect(out.prompt).toContain('a cordless moisture meter');
    expect(out.prompt.indexOf('a cordless moisture meter')).toBeLessThan(
      out.prompt.indexOf('cinematic')
    );
    expect(out.prompt).toMatch(/orbit/i);
  });

  it('appends the brand fragment last when provided', () => {
    const frag = brandFragmentFromDna({
      businessName: 'AquaDry',
      vertical: 'tradie',
      primaryColour: '#0044CC',
      secondaryColour: '#FFFFFF',
      tone: 'friendly and direct',
    });
    const out = composePrompt({
      methodCard: getMethodCard('product-reveal')!,
      subject: 'a cordless moisture meter',
      chips: [],
      brandFragment: frag,
    });
    expect(out.prompt.endsWith(frag)).toBe(true);
    expect(frag).toContain('AquaDry');
    expect(frag).toContain('#0044CC');
  });

  it('merges chip params under card params (card wins conflicts)', () => {
    const out = composePrompt({
      methodCard: {
        ...getMethodCard('product-reveal')!,
        params: { motion: 'slow' },
      },
      subject: 'x',
      chips: [
        {
          id: 'test-chip',
          category: 'style',
          name: 'Test',
          promptFragment: 'test look',
          params: { motion: 'fast', grain: 'fine' },
        },
      ],
    });
    expect(out.params.motion).toBe('slow'); // card-last wins
    expect(out.params.grain).toBe('fine');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/video-engine/cards.test.ts`
Expected: FAIL — `Cannot find module '@/lib/services/ai/video/cards/method-cards'`

- [ ] **Step 3: Write `method-cards.ts`**

```typescript
/**
 * Method cards — one per generation, the "recipe". DATA ONLY: adding a card is
 * a new entry here, never code elsewhere. {{subject}} is replaced by the
 * user's prompt at composition time.
 */
export interface MethodCard {
  id: string;
  name: string;
  description: string;
  thumbnail: string; // /public path; static images at launch
  promptScaffold: string;
  negativePrompt?: string;
  params: Record<string, string | number | boolean>;
  requiresImage: boolean;
  category: 'product' | 'brand' | 'story' | 'freeform';
  exampleSubjects: [string, string, string]; // F1: blank-prompt killers
}

export const METHOD_CARDS: MethodCard[] = [
  {
    id: 'product-reveal',
    name: 'Product Reveal',
    description: 'Dramatic unveiling of a product, hero-shot ending',
    thumbnail: '/video-cards/product-reveal.jpg',
    promptScaffold:
      'A dramatic product reveal of {{subject}}, starting in shadow, light sweeping across to reveal it, ending on a crisp hero shot, studio backdrop, shallow depth of field',
    negativePrompt: 'text, watermark, blurry, low quality',
    params: {},
    requiresImage: false,
    category: 'product',
    exampleSubjects: [
      'a cordless moisture meter on brushed steel',
      'a flat white in a branded ceramic cup',
      'a stack of fresh business cards fanning open',
    ],
  },
  {
    id: 'talking-product',
    name: 'Talking Product',
    description: 'Product front-and-centre with energetic presenter framing',
    thumbnail: '/video-cards/talking-product.jpg',
    promptScaffold:
      'An energetic social media presentation shot of {{subject}}, held up to camera, bright engaging framing, quick subtle zooms, the product is the hero',
    params: {},
    requiresImage: false,
    category: 'product',
    exampleSubjects: [
      'a new air scrubber unit with glowing status light',
      'a skincare bottle with droplets of water',
      'a barista holding a bag of single-origin beans',
    ],
  },
  {
    id: 'before-after',
    name: 'Before / After',
    description: 'Transformation wipe from problem state to restored state',
    thumbnail: '/video-cards/before-after.jpg',
    promptScaffold:
      'A satisfying before-and-after transformation of {{subject}}, the scene transitions from damaged/messy state to pristine restored state with a smooth wipe, same camera angle held throughout',
    params: {},
    requiresImage: false,
    category: 'story',
    exampleSubjects: [
      'a water-damaged living room carpet being restored',
      'a mould-stained bathroom ceiling made spotless',
      'a cluttered garage turned into a tidy workshop',
    ],
  },
  {
    id: 'logo-motion',
    name: 'Logo Motion',
    description: 'Animated brand mark with particles/light',
    thumbnail: '/video-cards/logo-motion.jpg',
    promptScaffold:
      'An elegant motion graphics animation of {{subject}}, particles and light trails assembling into the mark, dark premium background, smooth easing',
    params: {},
    requiresImage: true,
    category: 'brand',
    exampleSubjects: [
      'the company logo assembling from blue light particles',
      'the brand mark drawn by a single line of light',
      'the logo emerging from rippling water',
    ],
  },
  {
    id: 'lifestyle-broll',
    name: 'Lifestyle B-roll',
    description: 'Natural in-context footage of product/service in use',
    thumbnail: '/video-cards/lifestyle-broll.jpg',
    promptScaffold:
      'Natural lifestyle b-roll footage of {{subject}}, candid documentary feel, soft natural light, handheld subtle movement, authentic real-world setting',
    params: {},
    requiresImage: false,
    category: 'story',
    exampleSubjects: [
      'a technician setting up drying equipment in a hallway',
      'friends laughing over coffee at a sunlit cafe table',
      'a tradie loading tools into a ute at dawn',
    ],
  },
  {
    id: 'stat-punch',
    name: 'Stat Punch-in',
    description: 'Bold motion emphasis built around one statistic',
    thumbnail: '/video-cards/stat-punch.jpg',
    promptScaffold:
      'A bold kinetic scene emphasising {{subject}}, dramatic punch-in camera move, high contrast, strong focal emphasis, energetic pacing',
    params: {},
    requiresImage: false,
    category: 'brand',
    exampleSubjects: [
      'the number 87% glowing above a city skyline',
      'a rising graph made of light over a desk scene',
      'a stopwatch slamming down on 24 hours',
    ],
  },
  {
    id: 'unboxing',
    name: 'Unboxing',
    description: 'First-person unboxing/opening moment',
    thumbnail: '/video-cards/unboxing.jpg',
    promptScaffold:
      'A first-person unboxing shot of {{subject}}, hands opening packaging on a clean desk, anticipation pacing, soft top light, satisfying reveal',
    params: {},
    requiresImage: false,
    category: 'product',
    exampleSubjects: [
      'a branded welcome kit with embossed box',
      'a new power tool nested in moulded foam',
      'a subscription coffee box with fresh beans',
    ],
  },
  {
    id: 'seasonal-hook',
    name: 'Seasonal Hook',
    description: 'Holiday/season-themed scene around the subject',
    thumbnail: '/video-cards/seasonal-hook.jpg',
    promptScaffold:
      'A seasonal themed scene featuring {{subject}}, festive atmosphere appropriate to the season, warm inviting tones, gentle celebratory motion',
    params: {},
    requiresImage: false,
    category: 'story',
    exampleSubjects: [
      'a storefront window dressed for an Australian summer Christmas',
      'storm-season preparation gear laid out neatly',
      'an end-of-financial-year desk scene with calculator and coffee',
    ],
  },
  {
    id: 'freeform',
    name: 'Freeform',
    description: 'No scaffold — your prompt, optionally LLM-enhanced',
    thumbnail: '/video-cards/freeform.jpg',
    promptScaffold: '{{subject}}',
    params: {},
    requiresImage: false,
    category: 'freeform',
    exampleSubjects: [
      'a drone shot over flooded farmland at sunrise',
      'macro shot of paint mixing in slow motion',
      'a neon-lit rainy street with reflections',
    ],
  },
];

export function getMethodCard(id: string): MethodCard | undefined {
  return METHOD_CARDS.find(c => c.id === id);
}
```

- [ ] **Step 4: Write `modifier-chips.ts`**

```typescript
/**
 * Modifier chips — multi-select prompt fragments. DATA ONLY. Camera ships deep
 * (Higgsfield-style preset library is the proven differentiator; chips are free to add).
 */
export interface ModifierChip {
  id: string;
  category: 'style' | 'camera' | 'lighting';
  name: string;
  promptFragment: string;
  params?: Record<string, string | number | boolean>;
}

const style = (
  id: string,
  name: string,
  promptFragment: string
): ModifierChip => ({
  id: `style-${id}`,
  category: 'style',
  name,
  promptFragment,
});
const camera = (
  id: string,
  name: string,
  promptFragment: string
): ModifierChip => ({
  id: `camera-${id}`,
  category: 'camera',
  name,
  promptFragment,
});
const lighting = (
  id: string,
  name: string,
  promptFragment: string
): ModifierChip => ({
  id: `lighting-${id}`,
  category: 'lighting',
  name,
  promptFragment,
});

export const MODIFIER_CHIPS: ModifierChip[] = [
  // Style
  style(
    'cinematic',
    'Cinematic',
    'cinematic film look, anamorphic feel, filmic color grade'
  ),
  style(
    'animated',
    'Animated',
    '3D animated style, stylised rendering, smooth character motion'
  ),
  style(
    'documentary',
    'Documentary',
    'documentary realism, natural imperfect framing'
  ),
  style(
    'retro-film',
    'Retro Film',
    'vintage 16mm film stock, grain, faded colors'
  ),
  style(
    'clean-commercial',
    'Clean Commercial',
    'polished commercial advertising look, pristine surfaces'
  ),
  // Camera (deep on purpose)
  camera('dolly-in', 'Slow Dolly-in', 'slow dolly-in toward the subject'),
  camera(
    'dolly-out',
    'Dolly-out Reveal',
    'slow dolly-out revealing the wider scene'
  ),
  camera('orbit', '360 Orbit', 'smooth 360 degree orbit around the subject'),
  camera(
    'crash-zoom',
    'Crash Zoom',
    'sudden dramatic crash zoom onto the subject'
  ),
  camera(
    'bullet-time',
    'Bullet Time',
    'frozen bullet-time moment, camera sweeping around'
  ),
  camera('crane-up', 'Crane Up', 'crane shot rising up and over the scene'),
  camera(
    'crane-down',
    'Crane Down',
    'crane shot descending toward the subject'
  ),
  camera(
    'handheld',
    'Handheld',
    'subtle handheld camera shake, organic movement'
  ),
  camera('whip-pan', 'Whip Pan', 'fast whip pan transition energy'),
  camera(
    'tracking',
    'Tracking Shot',
    'smooth lateral tracking shot following the subject'
  ),
  camera(
    'low-angle',
    'Low Angle Push',
    'low angle push-in making the subject heroic'
  ),
  camera('top-down', 'Top-down', 'overhead top-down perspective'),
  camera('fpv', 'FPV Fly-through', 'fast FPV drone fly-through motion'),
  camera(
    'static-locked',
    'Locked Off',
    'perfectly static locked-off tripod shot'
  ),
  camera(
    'rack-focus',
    'Rack Focus',
    'rack focus shifting from foreground to the subject'
  ),
  // Lighting / Mood
  lighting(
    'golden-hour',
    'Golden Hour',
    'warm golden hour sunlight, long soft shadows'
  ),
  lighting(
    'moody-night',
    'Moody Night',
    'moody night scene, pools of practical light'
  ),
  lighting(
    'studio-soft',
    'Soft Studio',
    'soft diffused studio lighting, gentle gradients'
  ),
  lighting(
    'neon',
    'Neon Glow',
    'vibrant neon accent lighting, reflective surfaces'
  ),
  lighting(
    'overcast',
    'Overcast Natural',
    'even overcast daylight, true-to-life colors'
  ),
  lighting(
    'dramatic-rim',
    'Dramatic Rim',
    'high-contrast rim lighting carving the subject from darkness'
  ),
];

export function getChips(ids: string[]): ModifierChip[] {
  return ids
    .map(id => MODIFIER_CHIPS.find(c => c.id === id))
    .filter((c): c is ModifierChip => Boolean(c));
}
```

- [ ] **Step 5: Write `brand-cards.ts`**

```typescript
/**
 * Brand cards derive from the org's BrandDNA record (lib/brand-dna) — never
 * hand-authored. The fragment is appended LAST in composition so brand context
 * colours the whole prompt without overriding the method scaffold.
 */
import prisma from '@/lib/prisma';

export interface BrandFragmentInput {
  businessName: string;
  vertical: string;
  primaryColour: string | null;
  secondaryColour: string | null;
  tone: string;
}

export function brandFragmentFromDna(b: BrandFragmentInput): string {
  const colours = [b.primaryColour, b.secondaryColour]
    .filter(Boolean)
    .join(' and ');
  const colourClause = colours ? `, brand colour accents of ${colours}` : '';
  return `In the visual style of ${b.businessName} (${b.vertical} brand, ${b.tone})${colourClause}`;
}

/** Load the brand fragment for an org; null when the org has no BrandDNA yet. */
export async function getBrandFragment(
  organizationId: string
): Promise<string | null> {
  const dna = await prisma.brandDNA.findFirst({
    where: { organizationId },
    select: {
      businessName: true,
      vertical: true,
      primaryColour: true,
      secondaryColour: true,
      brandVoice: true,
    },
  });
  if (!dna) return null;
  const voice = dna.brandVoice as { tone?: string } | null;
  return brandFragmentFromDna({
    businessName: dna.businessName,
    vertical: dna.vertical,
    primaryColour: dna.primaryColour,
    secondaryColour: dna.secondaryColour,
    tone: voice?.tone ?? 'professional',
  });
}
```

NOTE: check the exact Prisma model name first with `grep -n "model BrandDNA" prisma/schema.prisma` — if the model or field names differ (e.g. `primaryColor` US spelling), match the schema, and update the `select` accordingly. The pure function `brandFragmentFromDna` is what the test covers; `getBrandFragment` is a thin DB wrapper.

- [ ] **Step 6: Write `compose.ts`**

```typescript
/**
 * Prompt composition: method scaffold (+subject) -> chips by category -> brand fragment.
 * Param merge: chips first (later chips overwrite earlier), card params LAST (card wins).
 */
import { MethodCard } from './method-cards';
import { ModifierChip } from './modifier-chips';

const CATEGORY_ORDER: ModifierChip['category'][] = [
  'style',
  'camera',
  'lighting',
];

export interface ComposeInput {
  methodCard: MethodCard;
  subject: string;
  chips: ModifierChip[];
  brandFragment?: string | null;
}

export interface ComposedPrompt {
  prompt: string;
  negativePrompt?: string;
  params: Record<string, string | number | boolean>;
}

export function composePrompt(input: ComposeInput): ComposedPrompt {
  const base = input.methodCard.promptScaffold.replaceAll(
    '{{subject}}',
    input.subject.trim()
  );

  const chipText = CATEGORY_ORDER.flatMap(cat =>
    input.chips.filter(c => c.category === cat).map(c => c.promptFragment)
  ).join(', ');

  const parts = [base];
  if (chipText) parts.push(chipText);
  if (input.brandFragment) parts.push(input.brandFragment);

  const params: Record<string, string | number | boolean> = {};
  for (const chip of input.chips) Object.assign(params, chip.params ?? {});
  Object.assign(params, input.methodCard.params); // card-last wins

  return {
    prompt: parts.join('. '),
    negativePrompt: input.methodCard.negativePrompt,
    params,
  };
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- __tests__/video-engine/cards.test.ts`
Expected: PASS (5 tests). If the brand test fails on `endsWith`, check `composePrompt` joins with `'. '` and the fragment has no trailing period.

- [ ] **Step 8: Commit**

```bash
git add lib/services/ai/video/cards __tests__/video-engine/cards.test.ts
git commit -m "feat(video): card registry - 9 method cards, 26 modifier chips, brand cards, composer"
```

---

### Task 4: Quota service (hold / settle / release; monthly + daily + MCP sub-cap)

**Files:**

- Create: `lib/services/ai/video/quota.ts`
- Test: `__tests__/video-engine/quota.test.ts`

- [ ] **Step 1: Write the failing test**

`__tests__/video-engine/quota.test.ts`:

```typescript
const mockFindUnique = jest.fn();
const mockUpsert = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    organizationVideoQuota: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      upsert: (...a: unknown[]) => mockUpsert(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        organizationVideoQuota: {
          findUnique: (...a: unknown[]) => mockFindUnique(...a),
          upsert: (...a: unknown[]) => mockUpsert(...a),
          update: (...a: unknown[]) => mockUpdate(...a),
        },
      }),
  },
}));

import {
  holdQuota,
  settleQuota,
  releaseQuota,
} from '@/lib/services/ai/video/quota';
import { QuotaExceededError } from '@/lib/services/ai/video/types';

const baseQuota = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'q1',
  organizationId: 'org1',
  monthlyBudgetUsd: 25,
  dailyBudgetUsd: 5,
  spentUsd: 0,
  spentTodayUsd: 0,
  spentTodayMcpUsd: 0,
  periodStart: new Date(),
  dayStart: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsert.mockImplementation(async ({ create }: { create: object }) =>
    baseQuota(create as object)
  );
  mockUpdate.mockResolvedValue(baseQuota());
});

describe('quota service', () => {
  it('holds the estimate when under both caps', async () => {
    mockUpsert.mockResolvedValue(baseQuota({ spentUsd: 1, spentTodayUsd: 1 }));
    await expect(holdQuota('org1', 0.3, 'studio')).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          spentUsd: { increment: 0.3 },
          spentTodayUsd: { increment: 0.3 },
        }),
      })
    );
  });

  it('rejects with the MONTHLY cap named when monthly would be exceeded', async () => {
    mockUpsert.mockResolvedValue(
      baseQuota({ spentUsd: 24.9, spentTodayUsd: 0 })
    );
    await expect(holdQuota('org1', 0.3, 'studio')).rejects.toThrow(
      QuotaExceededError
    );
    await expect(holdQuota('org1', 0.3, 'studio')).rejects.toMatchObject({
      cap: 'monthly',
    });
  });

  it('rejects with the DAILY cap named when daily would be exceeded', async () => {
    mockUpsert.mockResolvedValue(
      baseQuota({ spentUsd: 1, spentTodayUsd: 4.9 })
    );
    await expect(holdQuota('org1', 0.3, 'studio')).rejects.toMatchObject({
      cap: 'daily',
    });
  });

  it('caps MCP-initiated spend at 50% of daily budget', async () => {
    mockUpsert.mockResolvedValue(baseQuota({ spentTodayMcpUsd: 2.4 }));
    await expect(holdQuota('org1', 0.2, 'mcp')).rejects.toMatchObject({
      cap: 'mcp-daily',
    });
  });

  it('resets the monthly counter when periodStart is a previous month', async () => {
    const lastMonth = new Date();
    lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
    mockUpsert.mockResolvedValue(
      baseQuota({ spentUsd: 24.9, periodStart: lastMonth })
    );
    await expect(holdQuota('org1', 0.3, 'studio')).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          spentUsd: 0.3,
          periodStart: expect.any(Date),
        }),
      })
    );
  });

  it('resets the daily counters when dayStart is a previous day', async () => {
    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000);
    mockUpsert.mockResolvedValue(
      baseQuota({
        spentTodayUsd: 4.9,
        spentTodayMcpUsd: 2.4,
        dayStart: yesterday,
      })
    );
    await expect(holdQuota('org1', 0.3, 'mcp')).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          spentTodayUsd: 0.3,
          dayStart: expect.any(Date),
        }),
      })
    );
  });

  it('settle adjusts the hold to actual cost', async () => {
    await settleQuota('org1', 0.3, 0.27, 'studio');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          spentUsd: { increment: expect.closeTo(-0.03, 5) },
          spentTodayUsd: { increment: expect.closeTo(-0.03, 5) },
        }),
      })
    );
  });

  it('release subtracts the full hold', async () => {
    await releaseQuota('org1', 0.3, 'mcp');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          spentUsd: { increment: -0.3 },
          spentTodayUsd: { increment: -0.3 },
          spentTodayMcpUsd: { increment: -0.3 },
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/video-engine/quota.test.ts`
Expected: FAIL — `Cannot find module '@/lib/services/ai/video/quota'`

- [ ] **Step 3: Write `quota.ts`**

```typescript
/**
 * Org video-spend quota: monthly + daily caps with an MCP sub-cap.
 * Hold at submit, settle to actual at completion, release on failure.
 * Daily AND monthly counters reset lazily by date comparison at submit — no cron.
 * Spec: "Cost governance (all-day operation)".
 */
import prisma from '@/lib/prisma';
import { InitiatedBy, QuotaExceededError } from './types';

const MCP_DAILY_FRACTION = Number(
  process.env.VIDEO_MCP_DAILY_FRACTION ?? '0.5'
);

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function isSameUtcMonth(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 7) === b.toISOString().slice(0, 7);
}

export async function holdQuota(
  organizationId: string,
  estimateUsd: number,
  initiatedBy: InitiatedBy
): Promise<void> {
  await prisma.$transaction(async tx => {
    const quota = await tx.organizationVideoQuota.upsert({
      where: { organizationId },
      create: { organizationId },
      update: {},
    });

    const now = new Date();
    const dayStale = !isSameUtcDay(new Date(quota.dayStart), now);
    const monthStale = !isSameUtcMonth(new Date(quota.periodStart), now);
    const spentToday = dayStale ? 0 : Number(quota.spentTodayUsd);
    const spentTodayMcp = dayStale ? 0 : Number(quota.spentTodayMcpUsd);
    const monthly = Number(quota.monthlyBudgetUsd);
    const daily = Number(quota.dailyBudgetUsd);
    const spentMonth = monthStale ? 0 : Number(quota.spentUsd);

    if (spentMonth + estimateUsd > monthly) {
      throw new QuotaExceededError('monthly', monthly, spentMonth);
    }
    if (spentToday + estimateUsd > daily) {
      throw new QuotaExceededError('daily', daily, spentToday);
    }
    if (
      initiatedBy === 'mcp' &&
      spentTodayMcp + estimateUsd > daily * MCP_DAILY_FRACTION
    ) {
      throw new QuotaExceededError(
        'mcp-daily',
        daily * MCP_DAILY_FRACTION,
        spentTodayMcp
      );
    }

    // Lazy resets: a stale period sets the counter to the new estimate
    // instead of incrementing; otherwise atomic increment.
    const data: Record<string, unknown> = {
      spentUsd: monthStale ? estimateUsd : { increment: estimateUsd },
      spentTodayUsd: dayStale ? estimateUsd : { increment: estimateUsd },
    };
    if (monthStale) data.periodStart = now;
    if (dayStale) {
      data.dayStart = now;
      data.spentTodayMcpUsd = initiatedBy === 'mcp' ? estimateUsd : 0;
    } else if (initiatedBy === 'mcp') {
      data.spentTodayMcpUsd = { increment: estimateUsd };
    }
    await tx.organizationVideoQuota.update({ where: { organizationId }, data });
  });
}

/** Adjust a previous hold to the actual cost (delta may be negative or positive). */
export async function settleQuota(
  organizationId: string,
  heldUsd: number,
  actualUsd: number,
  initiatedBy: InitiatedBy
): Promise<void> {
  const delta = Math.round((actualUsd - heldUsd) * 10000) / 10000;
  if (delta === 0) return;
  await prisma.organizationVideoQuota.update({
    where: { organizationId },
    data: {
      spentUsd: { increment: delta },
      spentTodayUsd: { increment: delta },
      ...(initiatedBy === 'mcp'
        ? { spentTodayMcpUsd: { increment: delta } }
        : {}),
    },
  });
}

/** Return a full hold (failed job). */
export async function releaseQuota(
  organizationId: string,
  heldUsd: number,
  initiatedBy: InitiatedBy
): Promise<void> {
  await prisma.organizationVideoQuota.update({
    where: { organizationId },
    data: {
      spentUsd: { increment: -heldUsd },
      spentTodayUsd: { increment: -heldUsd },
      ...(initiatedBy === 'mcp'
        ? { spentTodayMcpUsd: { increment: -heldUsd } }
        : {}),
    },
  });
}

/** Read-only snapshot for UI banner / MCP budgetWarning (>=80% of any cap). */
export async function quotaSnapshot(organizationId: string) {
  const q = await prisma.organizationVideoQuota.findUnique({
    where: { organizationId },
  });
  if (!q)
    return {
      spentUsd: 0,
      monthlyBudgetUsd: 25,
      spentTodayUsd: 0,
      dailyBudgetUsd: 5,
      warning: false,
    };
  const stale = !isSameUtcDay(new Date(q.dayStart), new Date());
  const spentToday = stale ? 0 : Number(q.spentTodayUsd);
  const warning =
    Number(q.spentUsd) >= 0.8 * Number(q.monthlyBudgetUsd) ||
    spentToday >= 0.8 * Number(q.dailyBudgetUsd);
  return {
    spentUsd: Number(q.spentUsd),
    monthlyBudgetUsd: Number(q.monthlyBudgetUsd),
    spentTodayUsd: spentToday,
    dailyBudgetUsd: Number(q.dailyBudgetUsd),
    warning,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/video-engine/quota.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/services/ai/video/quota.ts __tests__/video-engine/quota.test.ts
git commit -m "feat(video): quota service - monthly/daily caps, MCP sub-cap, hold/settle/release"
```

---

### Task 5: fal.ai adapter (queue submit, webhook token verify/parse)

**Files:**

- Create: `lib/services/ai/video/fal-adapter.ts`
- Test: `__tests__/video-engine/fal-adapter.test.ts`

Webhook authenticity (phase 1): we append our own secret token to the webhook URL (`?token=FAL_WEBHOOK_SECRET`) and verify it constant-time server-side. Upgrading to fal's ed25519/JWKS verification is a noted follow-up, not phase 1.

- [ ] **Step 1: Write the failing test**

`__tests__/video-engine/fal-adapter.test.ts`:

```typescript
import {
  submitToFal,
  verifyWebhookToken,
  parseFalWebhook,
} from '@/lib/services/ai/video/fal-adapter';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.FAL_API_KEY = 'test-key';
  process.env.FAL_WEBHOOK_SECRET = 'shh-secret';
  process.env.NEXT_PUBLIC_APP_URL = 'https://synthex.example';
});

describe('fal adapter', () => {
  it('submits to the fal queue with auth header and webhook url', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ request_id: 'req-123' }),
    });
    const id = await submitToFal('fal-ai/wan/v2.5/text-to-video', {
      prompt: 'a test',
      aspect_ratio: '9:16',
      duration: 6,
    });
    expect(id).toBe('req-123');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain(
      'https://queue.fal.run/fal-ai/wan/v2.5/text-to-video'
    );
    expect(url).toContain('fal_webhook=');
    expect(decodeURIComponent(url)).toContain('token=shh-secret');
    expect(init.headers.Authorization).toBe('Key test-key');
    expect(JSON.parse(init.body).prompt).toBe('a test');
  });

  it('throws with the response body on a non-OK submit', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'bad input',
    });
    await expect(submitToFal('fal-ai/x', { prompt: 'p' })).rejects.toThrow(
      /422.*bad input/s
    );
  });

  it('verifies the webhook token constant-time', () => {
    expect(verifyWebhookToken('shh-secret')).toBe(true);
    expect(verifyWebhookToken('wrong')).toBe(false);
    expect(verifyWebhookToken(null)).toBe(false);
  });

  it('parses a success payload to videoUrl', () => {
    const out = parseFalWebhook({
      request_id: 'req-123',
      status: 'OK',
      payload: { video: { url: 'https://cdn.fal/video.mp4' } },
    });
    expect(out).toEqual({
      providerJobId: 'req-123',
      ok: true,
      videoUrl: 'https://cdn.fal/video.mp4',
    });
  });

  it('parses an error payload to a failure with message', () => {
    const out = parseFalWebhook({
      request_id: 'req-9',
      status: 'ERROR',
      error: 'content policy violation',
      payload: null,
    });
    expect(out.ok).toBe(false);
    expect(out.errorMessage).toMatch(/content policy/);
    expect(out.isPolicyRejection).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/video-engine/fal-adapter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `fal-adapter.ts`**

```typescript
/**
 * fal.ai queue adapter. Submit returns a request id; completion arrives at
 * POST /api/video/webhook/fal (token-authenticated URL). Docs: fal.ai/docs queue API.
 */
import { timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';

const FAL_QUEUE_BASE = 'https://queue.fal.run';

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not configured`);
  return v;
}

export function webhookUrl(): string {
  const base = requiredEnv('NEXT_PUBLIC_APP_URL').replace(/\/$/, '');
  const token = requiredEnv('FAL_WEBHOOK_SECRET');
  return `${base}/api/video/webhook/fal?token=${encodeURIComponent(token)}`;
}

/** Submit a generation to the fal queue; returns fal's request_id. */
export async function submitToFal(
  modelId: string,
  input: Record<string, unknown>
): Promise<string> {
  const apiKey = requiredEnv('FAL_API_KEY');
  const url = `${FAL_QUEUE_BASE}/${modelId}?fal_webhook=${encodeURIComponent(webhookUrl())}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error('fal submit failed', { modelId, status: res.status, body });
    throw new Error(`fal submit failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { request_id: string };
  return data.request_id;
}

/** Constant-time check of the webhook token query param. */
export function verifyWebhookToken(token: string | null): boolean {
  const secret = process.env.FAL_WEBHOOK_SECRET ?? '';
  if (!token || !secret) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface FalWebhookResult {
  providerJobId: string;
  ok: boolean;
  videoUrl?: string;
  errorMessage?: string;
  isPolicyRejection?: boolean;
}

const POLICY_PATTERNS = /content.?policy|nsfw|safety|moderat/i;

/** Normalize fal's webhook body. Shape: { request_id, status: 'OK'|'ERROR', payload, error }. */
export function parseFalWebhook(body: unknown): FalWebhookResult {
  const b = body as {
    request_id?: string;
    status?: string;
    payload?: { video?: { url?: string } } | null;
    error?: unknown;
  };
  const providerJobId = b.request_id ?? '';
  if (b.status === 'OK' && b.payload?.video?.url) {
    return { providerJobId, ok: true, videoUrl: b.payload.video.url };
  }
  const errorMessage =
    typeof b.error === 'string'
      ? b.error
      : JSON.stringify(b.error ?? 'unknown fal error');
  return {
    providerJobId,
    ok: false,
    errorMessage,
    isPolicyRejection: POLICY_PATTERNS.test(errorMessage),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/video-engine/fal-adapter.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/services/ai/video/fal-adapter.ts __tests__/video-engine/fal-adapter.test.ts
git commit -m "feat(video): fal queue adapter with token-authenticated webhook"
```

---

### Task 6: Generation service (orchestration + batch variants)

**Files:**

- Create: `lib/services/ai/video/generation-service.ts`
- Test: `__tests__/video-engine/generation-service.test.ts`

- [ ] **Step 1: Write the failing test**

`__tests__/video-engine/generation-service.test.ts`:

```typescript
const mockCreate = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    videoGeneration: { create: (...a: unknown[]) => mockCreate(...a) },
  },
}));

const mockHold = jest.fn();
jest.mock('@/lib/services/ai/video/quota', () => ({
  holdQuota: (...a: unknown[]) => mockHold(...a),
}));

const mockSubmit = jest.fn();
jest.mock('@/lib/services/ai/video/fal-adapter', () => ({
  submitToFal: (...a: unknown[]) => mockSubmit(...a),
}));

const mockBrand = jest.fn();
jest.mock('@/lib/services/ai/video/cards/brand-cards', () => ({
  getBrandFragment: (...a: unknown[]) => mockBrand(...a),
}));

import { submitGenerativeVideo } from '@/lib/services/ai/video/generation-service';

beforeEach(() => {
  jest.clearAllMocks();
  mockHold.mockResolvedValue(undefined);
  mockBrand.mockResolvedValue(null);
  mockSubmit.mockImplementation(
    async () => `req-${mockSubmit.mock.calls.length}`
  );
  mockCreate.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: `row-${mockCreate.mock.calls.length}`,
      ...data,
    })
  );
});

const baseReq = {
  userId: 'u1',
  organizationId: 'org1',
  initiatedBy: 'studio' as const,
  prompt: 'a cordless moisture meter',
  methodCardId: 'product-reveal',
};

describe('generation service', () => {
  it('holds quota on the SUMMED estimate before submitting anything', async () => {
    await submitGenerativeVideo({ ...baseReq, variants: 4 });
    expect(mockHold).toHaveBeenCalledTimes(1);
    const [, sum] = mockHold.mock.calls[0];
    expect(sum).toBeCloseTo(4 * 6 * 0.05, 4); // 4 variants x 6s x draft $/s
    expect(mockHold.mock.invocationCallOrder[0]).toBeLessThan(
      mockSubmit.mock.invocationCallOrder[0]
    );
  });

  it('creates one row per variant sharing batchGroupId, distinct seeds', async () => {
    const jobs = await submitGenerativeVideo({ ...baseReq, variants: 3 });
    expect(jobs).toHaveLength(3);
    const groups = new Set(jobs.map(j => j.batchGroupId));
    expect(groups.size).toBe(1);
    const seeds = mockCreate.mock.calls.map(c => c[0].data.seed);
    expect(new Set(seeds).size).toBe(3);
  });

  it('rejects unknown method cards', async () => {
    await expect(
      submitGenerativeVideo({ ...baseReq, methodCardId: 'nope' })
    ).rejects.toThrow(/unknown method card/i);
  });

  it('rejects image-required cards without an imageUrl', async () => {
    await expect(
      submitGenerativeVideo({ ...baseReq, methodCardId: 'logo-motion' })
    ).rejects.toThrow(/requires an input image/i);
  });

  it('caps variants at 8', async () => {
    await expect(
      submitGenerativeVideo({ ...baseReq, variants: 9 })
    ).rejects.toThrow(/variants/i);
  });

  it('does not create rows when quota hold fails', async () => {
    mockHold.mockRejectedValue(new Error('cap'));
    await expect(submitGenerativeVideo(baseReq)).rejects.toThrow('cap');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('applies the brand fragment when brandCardId is set', async () => {
    mockBrand.mockResolvedValue('In the visual style of AquaDry');
    await submitGenerativeVideo({ ...baseReq, brandCardId: 'org-brand-1' });
    const submittedPrompt = (mockSubmit.mock.calls[0][1] as { prompt: string })
      .prompt;
    expect(submittedPrompt).toContain('In the visual style of AquaDry');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/video-engine/generation-service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `generation-service.ts`**

```typescript
/**
 * Orchestration: validate -> compose -> quota hold (summed) -> submit each
 * variant to fal -> persist rows. Submit failures after a hold release it
 * proportionally (release path covered by webhook sweep for in-flight jobs).
 */
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { GenerativeVideoRequest, SubmittedJob } from './types';
import { resolveModel, estimateCostUsd } from './registry';
import { getMethodCard } from './cards/method-cards';
import { getChips } from './cards/modifier-chips';
import { getBrandFragment } from './cards/brand-cards';
import { composePrompt } from './cards/compose';
import { holdQuota, releaseQuota } from './quota';
import { submitToFal } from './fal-adapter';

const MAX_VARIANTS = 8;

export async function submitGenerativeVideo(
  req: GenerativeVideoRequest
): Promise<SubmittedJob[]> {
  const variants = req.variants ?? 1;
  if (variants < 1 || variants > MAX_VARIANTS) {
    throw new Error(`variants must be 1-${MAX_VARIANTS}`);
  }

  const methodCard = getMethodCard(req.methodCardId);
  if (!methodCard) throw new Error(`Unknown method card: ${req.methodCardId}`);
  if (methodCard.requiresImage && !req.imageUrl) {
    throw new Error(`Method card "${methodCard.name}" requires an input image`);
  }

  const tier = req.modelTier ?? 'draft'; // cost governance: draft-first is structural
  const aspectRatio = req.aspectRatio ?? '9:16';
  const durationSeconds = req.durationSeconds ?? 6;

  const model = resolveModel(tier, {
    aspectRatio,
    durationSeconds,
    audio: req.audio,
    requiresImage: Boolean(req.imageUrl),
  });

  const perJobUsd = estimateCostUsd(model, durationSeconds);
  const totalUsd = Math.round(perJobUsd * variants * 10000) / 10000;

  // Quota hold BEFORE any provider spend.
  await holdQuota(req.organizationId, totalUsd, req.initiatedBy);

  const brandFragment = req.brandCardId
    ? await getBrandFragment(req.brandCardId)
    : null;
  const chips = getChips(req.modifierIds ?? []);
  const composed = composePrompt({
    methodCard,
    subject: req.prompt,
    chips,
    brandFragment,
  });

  const batchGroupId = randomUUID();
  const jobs: SubmittedJob[] = [];

  try {
    for (let i = 0; i < variants; i++) {
      const seed = Math.floor(Math.random() * 2_147_483_647);
      const providerJobId = await submitToFal(model.id, {
        prompt: composed.prompt,
        ...(composed.negativePrompt
          ? { negative_prompt: composed.negativePrompt }
          : {}),
        ...(req.imageUrl ? { image_url: req.imageUrl } : {}),
        aspect_ratio: aspectRatio,
        duration: durationSeconds,
        seed,
        ...composed.params,
      });

      const row = await prisma.videoGeneration.create({
        data: {
          userId: req.userId,
          organizationId: req.organizationId,
          title: `${methodCard.name}: ${req.prompt.slice(0, 80)}`,
          topic: req.prompt.slice(0, 200),
          style: 'generative',
          duration: `${durationSeconds}s`,
          status: 'generating',
          mode: 'generative',
          provider: 'fal',
          model: model.id,
          providerJobId,
          initiatedBy: req.initiatedBy,
          inputPrompt: req.prompt,
          enhancedPrompt: composed.prompt,
          inputImageUrl: req.imageUrl,
          methodCardId: req.methodCardId,
          modifierIds: req.modifierIds ?? [],
          brandCardId: req.brandCardId,
          aspectRatio,
          durationSeconds,
          audioEnabled: Boolean(req.audio),
          batchGroupId,
          seed,
          estimatedCostUsd: perJobUsd,
        },
      });

      jobs.push({
        id: row.id,
        providerJobId,
        batchGroupId,
        model: model.id,
        estimatedCostUsd: perJobUsd,
        status: 'generating',
      });
    }
  } catch (err) {
    // Release the unspent remainder of the hold (variants that never submitted).
    const unsubmitted = variants - jobs.length;
    if (unsubmitted > 0) {
      await releaseQuota(
        req.organizationId,
        Math.round(perJobUsd * unsubmitted * 10000) / 10000,
        req.initiatedBy
      ).catch(e =>
        logger.error('quota release after partial submit failed', { e })
      );
    }
    if (jobs.length === 0) throw err;
    logger.error('partial batch submit', {
      batchGroupId,
      submitted: jobs.length,
      err,
    });
  }

  return jobs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/video-engine/generation-service.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/services/ai/video/generation-service.ts __tests__/video-engine/generation-service.test.ts
git commit -m "feat(video): generation service - quota-guarded batch submit to fal"
```

---

### Task 7: Webhook completion route

**Files:**

- Create: `app/api/video/webhook/fal/route.ts`
- Test: `__tests__/video-engine/webhook-route.test.ts`

- [ ] **Step 1: Write the failing test**

`__tests__/video-engine/webhook-route.test.ts`:

```typescript
/** @jest-environment node */
const mockFindFirst = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    videoGeneration: {
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
  },
}));

const mockSettle = jest.fn();
const mockRelease = jest.fn();
jest.mock('@/lib/services/ai/video/quota', () => ({
  settleQuota: (...a: unknown[]) => mockSettle(...a),
  releaseQuota: (...a: unknown[]) => mockRelease(...a),
}));

const mockStore = jest.fn();
jest.mock('@/lib/services/ai/video/artifact-store', () => ({
  storeArtifact: (...a: unknown[]) => mockStore(...a),
}));

import { POST } from '@/app/api/video/webhook/fal/route';
import { NextRequest } from 'next/server';

function webhookReq(body: object, token = 'shh-secret'): NextRequest {
  return new NextRequest(
    `https://synthex.example/api/video/webhook/fal?token=${token}`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

const pendingRow = {
  id: 'row-1',
  organizationId: 'org1',
  status: 'generating',
  initiatedBy: 'studio',
  estimatedCostUsd: 0.3,
  durationSeconds: 6,
  model: 'fal-ai/wan/v2.5/text-to-video',
  userId: 'u1',
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.FAL_WEBHOOK_SECRET = 'shh-secret';
  mockFindFirst.mockResolvedValue(pendingRow);
  mockUpdate.mockResolvedValue({});
  mockStore.mockResolvedValue({ storedUrl: 'https://supabase/x.mp4' });
});

describe('POST /api/video/webhook/fal', () => {
  it('rejects a bad token with 401 and touches nothing', async () => {
    const res = await POST(
      webhookReq({ request_id: 'r1', status: 'OK' }, 'wrong')
    );
    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('completes a success: stores artifact, updates row, settles quota', async () => {
    const res = await POST(
      webhookReq({
        request_id: 'r1',
        status: 'OK',
        payload: { video: { url: 'https://cdn.fal/v.mp4' } },
      })
    );
    expect(res.status).toBe(200);
    expect(mockStore).toHaveBeenCalledWith(
      expect.objectContaining({ sourceUrl: 'https://cdn.fal/v.mp4' })
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'rendered',
          videoUrl: 'https://supabase/x.mp4',
        }),
      })
    );
    expect(mockSettle).toHaveBeenCalled();
  });

  it('is idempotent: a repeat webhook for a completed row is a 200 no-op', async () => {
    mockFindFirst.mockResolvedValue({ ...pendingRow, status: 'rendered' });
    const res = await POST(
      webhookReq({
        request_id: 'r1',
        status: 'OK',
        payload: { video: { url: 'x' } },
      })
    );
    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it('marks failures failed and releases the hold', async () => {
    const res = await POST(
      webhookReq({
        request_id: 'r1',
        status: 'ERROR',
        error: 'content policy violation',
      })
    );
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: expect.stringMatching(/policy/i),
        }),
      })
    );
    expect(mockRelease).toHaveBeenCalledWith('org1', 0.3, 'studio');
  });

  it('returns 200 for unknown request ids (fal retries otherwise) but logs', async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await POST(webhookReq({ request_id: 'ghost', status: 'OK' }));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/video-engine/webhook-route.test.ts`
Expected: FAIL — modules not found (`artifact-store`, route).

- [ ] **Step 3: Write `lib/services/ai/video/artifact-store.ts`**

Download from the (expiring) fal CDN URL into Supabase storage and register in the media library. 3 download attempts with backoff per spec error handling.

```typescript
/**
 * Persist a provider artifact: download (3 attempts, backoff) -> Supabase
 * storage bucket 'generated-videos' -> media library row. Provider URLs expire.
 */
import { createClient } from '@supabase/supabase-js';
import { mediaLibraryService } from '@/lib/services/media-library';
import { logger } from '@/lib/logger';

export interface StoreArtifactInput {
  sourceUrl: string;
  userId: string;
  rowId: string; // VideoGeneration id, used as the storage filename
  prompt?: string;
  metadata?: Record<string, unknown>;
}

async function fetchWithRetry(url: string, attempts = 3): Promise<ArrayBuffer> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`download ${res.status}`);
      return await res.arrayBuffer();
    } catch (err) {
      lastErr = err;
      await new Promise(r => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastErr;
}

export async function storeArtifact(
  input: StoreArtifactInput
): Promise<{ storedUrl: string }> {
  const buffer = await fetchWithRetry(input.sourceUrl);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const path = `${input.userId}/${input.rowId}.mp4`;
  const { error } = await supabase.storage
    .from('generated-videos')
    .upload(path, buffer, { contentType: 'video/mp4', upsert: true });
  if (error) throw new Error(`supabase upload failed: ${error.message}`);

  const { data: pub } = supabase.storage
    .from('generated-videos')
    .getPublicUrl(path);
  const storedUrl = pub.publicUrl;

  // Register in the media library; provider value follows existing enum style.
  await mediaLibraryService
    .createAsset(input.userId, {
      type: 'video',
      provider: 'fal' as never, // extend MediaProvider union in media-library.ts (see step note)
      url: storedUrl,
      externalId: input.rowId,
      prompt: input.prompt,
      metadata: input.metadata ?? {},
    })
    .catch(e =>
      logger.error('media library registration failed (non-fatal)', { e })
    );

  return { storedUrl };
}
```

ALSO modify `lib/services/media-library.ts:19-27`: add `| 'fal'` to the `MediaProvider` union, then remove the `as never` cast above.

NOTE: create the `generated-videos` storage bucket (public read) in Supabase if it does not exist — `npx supabase storage` or dashboard; flag for human if no access.

- [ ] **Step 4: Write `app/api/video/webhook/fal/route.ts`**

```typescript
/**
 * fal.ai completion webhook. Token-authenticated URL (FAL_WEBHOOK_SECRET).
 * Idempotent on providerJobId: repeat webhooks for settled rows are 200 no-ops.
 * Always 200 for unknown ids — non-200 makes fal retry forever.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  verifyWebhookToken,
  parseFalWebhook,
} from '@/lib/services/ai/video/fal-adapter';
import { settleQuota, releaseQuota } from '@/lib/services/ai/video/quota';
import { storeArtifact } from '@/lib/services/ai/video/artifact-store';
import { VIDEO_MODELS } from '@/lib/services/ai/video/registry';
import { InitiatedBy } from '@/lib/services/ai/video/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!verifyWebhookToken(request.nextUrl.searchParams.get('token'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = parseFalWebhook(await request.json());

  const row = await prisma.videoGeneration.findFirst({
    where: { providerJobId: result.providerJobId, mode: 'generative' },
  });
  if (!row) {
    logger.warn('fal webhook for unknown job', {
      providerJobId: result.providerJobId,
    });
    return NextResponse.json({ ok: true, unknown: true });
  }
  if (row.status !== 'generating') {
    return NextResponse.json({ ok: true, idempotent: true }); // already settled
  }

  const heldUsd = Number(row.estimatedCostUsd ?? 0);
  const initiatedBy = (row.initiatedBy ?? 'studio') as InitiatedBy;

  if (result.ok && result.videoUrl) {
    try {
      const { storedUrl } = await storeArtifact({
        sourceUrl: result.videoUrl,
        userId: row.userId,
        rowId: row.id,
        prompt: row.enhancedPrompt ?? undefined,
        metadata: { model: row.model, batchGroupId: row.batchGroupId },
      });

      const spec = VIDEO_MODELS.find(m => m.id === row.model);
      const actualUsd = spec
        ? Math.round(
            spec.costPerSecondUsd * (row.durationSeconds ?? 6) * 10000
          ) / 10000
        : heldUsd;

      await prisma.videoGeneration.update({
        where: { id: row.id },
        data: {
          status: 'rendered',
          videoUrl: storedUrl,
          actualCostUsd: actualUsd,
          metadata: {
            ...((row.metadata as object) ?? {}),
            providerUrl: result.videoUrl,
          },
        },
      });
      await settleQuota(
        row.organizationId ?? '',
        heldUsd,
        actualUsd,
        initiatedBy
      );
    } catch (err) {
      logger.error('artifact persistence failed', { rowId: row.id, err });
      await prisma.videoGeneration.update({
        where: { id: row.id },
        data: {
          status: 'failed',
          errorMessage: 'artifact download/storage failed',
          metadata: {
            ...((row.metadata as object) ?? {}),
            providerUrl: result.videoUrl,
          },
        },
      });
      await releaseQuota(row.organizationId ?? '', heldUsd, initiatedBy);
    }
  } else {
    await prisma.videoGeneration.update({
      where: { id: row.id },
      data: {
        status: 'failed',
        errorMessage: result.isPolicyRejection
          ? `Prompt rejected by provider content policy: ${result.errorMessage}`
          : result.errorMessage,
      },
    });
    await releaseQuota(row.organizationId ?? '', heldUsd, initiatedBy);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- __tests__/video-engine/webhook-route.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add app/api/video/webhook lib/services/ai/video/artifact-store.ts lib/services/media-library.ts __tests__/video-engine/webhook-route.test.ts
git commit -m "feat(video): fal webhook route - artifact persistence, quota settle/release, idempotency"
```

---

### Task 8: REST surface — extend generate route, add cards route

**Files:**

- Modify: `app/api/video/generate/route.ts` (add generative branch before script logic)
- Create: `app/api/video/cards/route.ts`
- Test: `__tests__/video-engine/generate-route.test.ts`

- [ ] **Step 1: Write the failing test**

`__tests__/video-engine/generate-route.test.ts`:

```typescript
/** @jest-environment node */
const mockCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...a: unknown[]) => mockCheck(...a),
    createSecureResponse: (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: { AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE' },
}));

jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: jest.fn().mockResolvedValue('org1'),
}));

const mockSubmitGen = jest.fn();
jest.mock('@/lib/services/ai/video/generation-service', () => ({
  submitGenerativeVideo: (...a: unknown[]) => mockSubmitGen(...a),
}));

// Script-mode deps (not exercised here but imported by the route)
jest.mock('@/lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('@/lib/ai/providers', () => ({ getAIProvider: jest.fn() }));

import { POST } from '@/app/api/video/generate/route';
import { NextRequest } from 'next/server';
import { QuotaExceededError } from '@/lib/services/ai/video/types';

const post = (body: object) =>
  POST(
    new NextRequest('https://synthex.example/api/video/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'u1' } });
  mockSubmitGen.mockResolvedValue([
    {
      id: 'row-1',
      providerJobId: 'r1',
      batchGroupId: 'b1',
      model: 'm',
      estimatedCostUsd: 0.3,
      status: 'generating',
    },
  ]);
});

describe('POST /api/video/generate (mode: generative)', () => {
  it('routes generative mode to the generation service with org + user context', async () => {
    const res = await post({
      mode: 'generative',
      prompt: 'a moisture meter',
      methodCardId: 'product-reveal',
    });
    expect(res.status).toBe(200);
    expect(mockSubmitGen).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        organizationId: 'org1',
        initiatedBy: 'studio',
        prompt: 'a moisture meter',
      })
    );
    const body = await res.json();
    expect(body.data.jobs).toHaveLength(1);
  });

  it('400s on invalid generative payloads (missing methodCardId)', async () => {
    const res = await post({ mode: 'generative', prompt: 'x' });
    expect(res.status).toBe(400);
    expect(mockSubmitGen).not.toHaveBeenCalled();
  });

  it('maps QuotaExceededError to 402 with the cap named', async () => {
    mockSubmitGen.mockRejectedValue(new QuotaExceededError('daily', 5, 4.9));
    const res = await post({
      mode: 'generative',
      prompt: 'x',
      methodCardId: 'product-reveal',
    });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toMatch(/daily/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/video-engine/generate-route.test.ts`
Expected: FAIL — generative branch absent (route falls through to script schema and 400s differently / `mockSubmitGen` never called in test 1).

- [ ] **Step 3: Modify `app/api/video/generate/route.ts`**

Add imports at the top (after existing imports, ~line 22):

```typescript
import { submitGenerativeVideo } from '@/lib/services/ai/video/generation-service';
import { QuotaExceededError } from '@/lib/services/ai/video/types';
```

Add the schema next to `GenerateVideoSchema` (~line 35):

```typescript
const GenerativeVideoSchema = z.object({
  mode: z.literal('generative'),
  prompt: z.string().min(3).max(1000),
  imageUrl: z.string().url().optional(),
  methodCardId: z.string().min(1),
  modifierIds: z.array(z.string()).max(12).optional(),
  brandCardId: z.string().optional(),
  audio: z.boolean().optional(),
  variants: z.number().int().min(1).max(8).optional(),
  modelTier: z.enum(['draft', 'standard', 'premium']).optional(),
  aspectRatio: z.enum(['9:16', '1:1', '16:9']).optional(),
  durationSeconds: z.number().int().min(4).max(10).optional(),
});
```

Inside `POST`, immediately after `const body = await request.json();` (line 89) and BEFORE the existing `GenerateVideoSchema.safeParse(body)`, insert the branch:

```typescript
// ---- Generative mode (fal.ai engine) -------------------------------
if (body?.mode === 'generative') {
  const parsed = GenerativeVideoSchema.safeParse(body);
  if (!parsed.success) {
    return APISecurityChecker.createSecureResponse(
      {
        success: false,
        error: 'Invalid request',
        details: parsed.error.issues,
      },
      400
    );
  }
  const organizationId = await getEffectiveOrganizationId(userId);
  try {
    const jobs = await submitGenerativeVideo({
      ...parsed.data,
      userId,
      organizationId: organizationId ?? '',
      initiatedBy: 'studio',
    });
    return APISecurityChecker.createSecureResponse({
      success: true,
      data: { jobs },
    });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return APISecurityChecker.createSecureResponse(
        { success: false, error: err.message, cap: err.cap },
        402
      );
    }
    logger.error('generative video submit failed', { err });
    return APISecurityChecker.createSecureResponse(
      {
        success: false,
        error: err instanceof Error ? err.message : 'submit failed',
      },
      500
    );
  }
}
// ---- Script mode (existing behaviour, unchanged below) -------------
```

- [ ] **Step 4: Create `app/api/video/cards/route.ts`**

```typescript
/**
 * GET /api/video/cards — the card registry + model tiers for the studio UI,
 * copilot, and MCP list_cards. Brand cards resolve per the caller's org.
 */
import { NextRequest } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { METHOD_CARDS } from '@/lib/services/ai/video/cards/method-cards';
import { MODIFIER_CHIPS } from '@/lib/services/ai/video/cards/modifier-chips';
import { getBrandFragment } from '@/lib/services/ai/video/cards/brand-cards';
import { VIDEO_MODELS } from '@/lib/services/ai/video/registry';
import { quotaSnapshot } from '@/lib/services/ai/video/quota';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!security.allowed || !security.context.userId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'unauthorized' },
      401
    );
  }
  const organizationId = await getEffectiveOrganizationId(
    security.context.userId
  );
  const brandFragment = organizationId
    ? await getBrandFragment(organizationId)
    : null;

  return APISecurityChecker.createSecureResponse({
    methodCards: METHOD_CARDS,
    modifierChips: MODIFIER_CHIPS,
    brandCard: brandFragment
      ? { organizationId, fragment: brandFragment }
      : null,
    models: VIDEO_MODELS,
    quota: organizationId ? await quotaSnapshot(organizationId) : null,
  });
}
```

- [ ] **Step 5: Run tests + type-check**

Run: `npm test -- __tests__/video-engine/generate-route.test.ts; npm run type-check`
Expected: PASS (3 tests); type-check clean.

- [ ] **Step 6: Commit**

```bash
git add app/api/video/generate/route.ts app/api/video/cards __tests__/video-engine/generate-route.test.ts
git commit -m "feat(video): generative branch on generate route + cards endpoint"
```

---

### Task 9: Stale-job sweep (missed-webhook safety net)

**Files:**

- Create: `app/api/cron/video-sweep/route.ts`
- Test: `__tests__/video-engine/video-sweep.test.ts`

Follow the auth pattern of the existing cron routes (check `app/api/cron/video-production/route.ts` — it verifies `Authorization: Bearer ${process.env.CRON_SECRET}`; mirror exactly what it does).

- [ ] **Step 1: Write the failing test**

`__tests__/video-engine/video-sweep.test.ts`:

```typescript
/** @jest-environment node */
const mockFindMany = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    videoGeneration: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
  },
}));
const mockRelease = jest.fn();
jest.mock('@/lib/services/ai/video/quota', () => ({
  releaseQuota: (...a: unknown[]) => mockRelease(...a),
}));

import { GET } from '@/app/api/cron/video-sweep/route';
import { NextRequest } from 'next/server';

const req = (auth?: string) =>
  new NextRequest('https://synthex.example/api/cron/video-sweep', {
    headers: auth ? { authorization: auth } : {},
  });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = 'cron-secret';
  mockUpdate.mockResolvedValue({});
});

describe('GET /api/cron/video-sweep', () => {
  it('401s without the cron secret', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('fails generative jobs stuck >30min and releases their holds', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'r1',
        organizationId: 'org1',
        estimatedCostUsd: 0.3,
        initiatedBy: 'mcp',
      },
    ]);
    const res = await GET(req('Bearer cron-secret'));
    expect(res.status).toBe(200);
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.mode).toBe('generative');
    expect(where.status).toBe('generating');
    expect(where.updatedAt.lt).toBeInstanceOf(Date);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({ status: 'failed' }),
      })
    );
    expect(mockRelease).toHaveBeenCalledWith('org1', 0.3, 'mcp');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/video-engine/video-sweep.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Write the route**

```typescript
/**
 * Cron sweep: any generative job still 'generating' after 30 min lost its
 * webhook — mark failed with a diagnostic and release the quota hold.
 * Schedule alongside existing crons in vercel.json (every 15 min).
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { releaseQuota } from '@/lib/services/ai/video/quota';
import { InitiatedBy } from '@/lib/services/ai/video/types';

export const dynamic = 'force-dynamic';

const STALE_MINUTES = 30;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
  const stale = await prisma.videoGeneration.findMany({
    where: {
      mode: 'generative',
      status: 'generating',
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true,
      organizationId: true,
      estimatedCostUsd: true,
      initiatedBy: true,
    },
  });

  for (const row of stale) {
    await prisma.videoGeneration.update({
      where: { id: row.id },
      data: {
        status: 'failed',
        errorMessage: `No provider webhook within ${STALE_MINUTES} minutes (sweep)`,
      },
    });
    await releaseQuota(
      row.organizationId ?? '',
      Number(row.estimatedCostUsd ?? 0),
      (row.initiatedBy ?? 'studio') as InitiatedBy
    ).catch(e =>
      logger.error('sweep quota release failed', { rowId: row.id, e })
    );
  }

  if (stale.length > 0)
    logger.warn('video sweep failed stale jobs', { count: stale.length });
  return NextResponse.json({ swept: stale.length });
}
```

Also add to `vercel.json` crons array (match the existing cron entry format exactly):

```json
{ "path": "/api/cron/video-sweep", "schedule": "*/15 * * * *" }
```

- [ ] **Step 4: Run test, then commit**

Run: `npm test -- __tests__/video-engine/video-sweep.test.ts`
Expected: PASS (2 tests)

```bash
git add app/api/cron/video-sweep vercel.json __tests__/video-engine/video-sweep.test.ts
git commit -m "feat(video): stale-job sweep cron with quota release"
```

---

### Task 9b: Lazy status poll-through on `GET /api/video/[id]`

**Files:**

- Modify: `lib/services/ai/video/fal-adapter.ts` (add `getFalStatus`)
- Modify: `app/api/video/[id]/route.ts` (read the existing GET handler first; insert the poll-through before its response)
- Test: append to `__tests__/video-engine/fal-adapter.test.ts`

- [ ] **Step 1: Append the failing test to `fal-adapter.test.ts`**

```typescript
describe('getFalStatus', () => {
  it('queries the queue status endpoint with auth', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'COMPLETED' }),
    });
    const { getFalStatus } =
      await import('@/lib/services/ai/video/fal-adapter');
    const s = await getFalStatus('fal-ai/wan/v2.5/text-to-video', 'req-1');
    expect(s).toBe('COMPLETED');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'https://queue.fal.run/fal-ai/wan/v2.5/text-to-video/requests/req-1/status'
    );
    expect(init.headers.Authorization).toBe('Key test-key');
  });
});
```

Run: `npm test -- __tests__/video-engine/fal-adapter.test.ts` → the new test FAILS (no export).

- [ ] **Step 2: Add `getFalStatus` to `fal-adapter.ts`**

```typescript
/** Queue status for a request: IN_QUEUE | IN_PROGRESS | COMPLETED (or throws). */
export async function getFalStatus(
  modelId: string,
  requestId: string
): Promise<string> {
  const apiKey = requiredEnv('FAL_API_KEY');
  const res = await fetch(
    `${FAL_QUEUE_BASE}/${modelId}/requests/${requestId}/status`,
    {
      headers: { Authorization: `Key ${apiKey}` },
    }
  );
  if (!res.ok) throw new Error(`fal status failed (${res.status})`);
  const data = (await res.json()) as { status: string };
  return data.status;
}
```

Run the test again → PASS.

- [ ] **Step 3: Wire poll-through into `app/api/video/[id]/route.ts`**

Read the existing GET handler first; after it loads the row and before it responds, insert (adapting variable names to the file):

```typescript
// Lazy poll-through: generative job past expected latency with no webhook yet.
const EXPECTED_LATENCY_MS = 5 * 60 * 1000;
if (
  video.mode === 'generative' &&
  video.status === 'generating' &&
  video.providerJobId &&
  video.model &&
  Date.now() - new Date(video.updatedAt).getTime() > EXPECTED_LATENCY_MS
) {
  try {
    const { getFalStatus } =
      await import('@/lib/services/ai/video/fal-adapter');
    const falStatus = await getFalStatus(video.model, video.providerJobId);
    // COMPLETED with no webhook received -> let the sweep settle it; surface progress.
    (video as Record<string, unknown>).providerStatus = falStatus;
  } catch {
    // best-effort; never fail the GET over a poll
  }
}
```

- [ ] **Step 4: Verify and commit**

Run: `npm test -- __tests__/video-engine/fal-adapter.test.ts; npm run type-check`
Expected: PASS.

```bash
git add lib/services/ai/video/fal-adapter.ts app/api/video/[id]/route.ts __tests__/video-engine/fal-adapter.test.ts
git commit -m "feat(video): lazy fal status poll-through on job GET"
```

---

### Task 10: LLM routing + prompt enhancer

**Files:**

- Create: `lib/services/ai/video/llm-routing.ts`
- Create: `lib/services/ai/video/prompt-enhancer.ts`
- Test: `__tests__/video-engine/prompt-enhancer.test.ts`

- [ ] **Step 1: Write `llm-routing.ts`** (pure config — no test needed beyond type-check)

```typescript
/**
 * LLM token routing — cost governance for assist tasks. Routine assists run on
 * the cheapest capable model; premium LLM use is reserved for explicit user
 * requests. Tune via env without code changes: LLM_ROUTING_<TASK> overrides.
 */
export type AssistTask =
  | 'prompt-enhance'
  | 'caption-draft'
  | 'fix-retry'
  | 'canvas-compose';

const DEFAULTS: Record<AssistTask, string> = {
  'prompt-enhance': 'google/gemini-2.5-flash',
  'caption-draft': 'google/gemini-2.5-flash',
  'fix-retry': 'google/gemini-2.5-flash',
  'canvas-compose': 'moonshotai/kimi-k2',
};

export function modelForTask(task: AssistTask): string {
  const envKey = `LLM_ROUTING_${task.toUpperCase().replace(/-/g, '_')}`;
  return process.env[envKey] ?? DEFAULTS[task];
}
```

NOTE: verify these OpenRouter model ids resolve through the existing provider (`lib/ai/providers`) — `getAIProvider().complete({ model: … })` as used in `app/api/video/generate/route.ts:138`. If the provider abstraction names models differently (e.g. `aiProvider.models.fast`), map to that instead and keep `modelForTask` returning whatever string that provider accepts.

- [ ] **Step 2: Write the failing enhancer test**

`__tests__/video-engine/prompt-enhancer.test.ts`:

```typescript
const mockComplete = jest.fn();
jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: () => ({
    models: { fast: 'fast-model', balanced: 'balanced-model' },
    complete: (...a: unknown[]) => mockComplete(...a),
  }),
}));

import { enhancePrompt } from '@/lib/services/ai/video/prompt-enhancer';

beforeEach(() => {
  jest.clearAllMocks();
  mockComplete.mockResolvedValue({
    choices: [
      {
        message: {
          content: 'a cinematic dolly-in shot of a meter, golden light',
        },
      },
    ],
  });
});

describe('prompt enhancer', () => {
  it('returns the LLM expansion', async () => {
    const out = await enhancePrompt('a moisture meter');
    expect(out).toContain('cinematic');
    const call = mockComplete.mock.calls[0][0] as { max_tokens: number };
    expect(call.max_tokens).toBeLessThanOrEqual(300); // cheap, bounded
  });

  it('falls back to the raw subject when the LLM fails', async () => {
    mockComplete.mockRejectedValue(new Error('llm down'));
    await expect(enhancePrompt('a moisture meter')).resolves.toBe(
      'a moisture meter'
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then write `prompt-enhancer.ts`**

Run: `npm test -- __tests__/video-engine/prompt-enhancer.test.ts` → FAIL (module not found).

```typescript
/**
 * Cheap-LLM expansion of a plain subject into a cinematography-grade prompt.
 * Used only for the Freeform card (other cards carry their own scaffolds).
 * Failure-safe: any LLM error returns the raw subject — never block generation.
 */
import { getAIProvider } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';

const SYSTEM = `You expand short video ideas into one vivid text-to-video prompt.
Include: shot type, camera motion, lighting, subject motion, setting.
One sentence, max 60 words, no preamble, no quotes.`;

export async function enhancePrompt(subject: string): Promise<string> {
  try {
    const ai = getAIProvider();
    const res = await ai.complete({
      model: ai.models.fast ?? ai.models.balanced, // cheapest capable per LLM routing policy
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: subject },
      ],
      temperature: 0.8,
      max_tokens: 150,
    });
    const out = res.choices[0]?.message?.content?.trim();
    return out || subject;
  } catch (err) {
    logger.warn('prompt enhancement failed, using raw subject', { err });
    return subject;
  }
}
```

Then wire it into `generation-service.ts`: in `submitGenerativeVideo`, replace the `composePrompt` call's subject for the freeform card:

```typescript
const subject =
  methodCard.id === 'freeform' ? await enhancePrompt(req.prompt) : req.prompt;
// …and pass `subject` instead of `req.prompt` to composePrompt({ … subject … })
```

(add `import { enhancePrompt } from './prompt-enhancer';` at the top). Re-run Task 6's test to confirm nothing broke: `npm test -- __tests__/video-engine/generation-service.test.ts` (its cards are non-freeform, so the enhancer is not invoked).

- [ ] **Step 4: Run tests, type-check, commit**

Run: `npm test -- __tests__/video-engine/prompt-enhancer.test.ts __tests__/video-engine/generation-service.test.ts; npm run type-check`
Expected: PASS.

```bash
git add lib/services/ai/video/llm-routing.ts lib/services/ai/video/prompt-enhancer.ts lib/services/ai/video/generation-service.ts __tests__/video-engine/prompt-enhancer.test.ts
git commit -m "feat(video): LLM routing config + failure-safe prompt enhancer for freeform card"
```

---

### Task 11: Tool layer (`studio-tools`)

**Files:**

- Create: `lib/services/ai/studio-tools/index.ts`
- Test: `__tests__/video-engine/studio-tools.test.ts`

The single typed contract consumed by REST (already wired), MCP (Task 12), and the Plan-2 copilot. Each tool: `{ name, description, schema (zod), execute(args, ctx) }` where `ctx = { userId, organizationId, initiatedBy }`.

- [ ] **Step 1: Write the failing test**

`__tests__/video-engine/studio-tools.test.ts`:

```typescript
const mockSubmitGen = jest.fn();
jest.mock('@/lib/services/ai/video/generation-service', () => ({
  submitGenerativeVideo: (...a: unknown[]) => mockSubmitGen(...a),
}));
const mockFindMany = jest.fn();
const mockFindFirst = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    videoGeneration: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
    },
  },
}));
jest.mock('@/lib/services/ai/video/cards/brand-cards', () => ({
  getBrandFragment: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/services/ai/video/quota', () => ({
  quotaSnapshot: jest.fn().mockResolvedValue({ warning: false }),
}));

import {
  STUDIO_TOOLS,
  executeStudioTool,
} from '@/lib/services/ai/studio-tools';

const ctx = {
  userId: 'u1',
  organizationId: 'org1',
  initiatedBy: 'mcp' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSubmitGen.mockResolvedValue([{ id: 'row-1', status: 'generating' }]);
  mockFindFirst.mockResolvedValue({
    id: 'row-1',
    status: 'rendered',
    videoUrl: 'u',
  });
  mockFindMany.mockResolvedValue([]);
});

describe('studio tools', () => {
  it('exposes the phase-1 tool set', () => {
    expect(STUDIO_TOOLS.map(t => t.name).sort()).toEqual(
      [
        'draft_caption',
        'generate_image',
        'generate_video',
        'get_job',
        'list_cards',
        'list_jobs',
        'search_media_library',
      ].sort()
    );
    for (const t of STUDIO_TOOLS)
      expect(t.description.length).toBeGreaterThan(10);
  });

  it('generate_video validates args via zod and forwards ctx (initiatedBy=mcp)', async () => {
    const out = await executeStudioTool(
      'generate_video',
      { prompt: 'a meter', methodCardId: 'product-reveal' },
      ctx
    );
    expect(mockSubmitGen).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        organizationId: 'org1',
        initiatedBy: 'mcp',
      })
    );
    expect(out.jobs).toHaveLength(1);
    expect(out.budgetWarning).toBe(false);
  });

  it('rejects invalid args with a zod error, not a crash', async () => {
    await expect(
      executeStudioTool('generate_video', { prompt: 'x' }, ctx) // missing methodCardId
    ).rejects.toThrow(/methodCardId/);
    expect(mockSubmitGen).not.toHaveBeenCalled();
  });

  it('get_job scopes lookups to the caller org', async () => {
    await executeStudioTool('get_job', { id: 'row-1' }, ctx);
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'row-1', organizationId: 'org1' }),
      })
    );
  });

  it('throws on unknown tool names', async () => {
    await expect(executeStudioTool('publish_post', {}, ctx)).rejects.toThrow(
      /unknown tool/i
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/video-engine/studio-tools.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/services/ai/studio-tools/index.ts`**

```typescript
/**
 * Studio tool layer — the SINGLE typed contract for everything the studio can
 * do. REST routes, the MCP server, and the in-app copilot are thin wrappers
 * over these. NO publish/schedule tools in phase 1 (spec: agents generate and
 * draft; pushing to the publish queue stays human).
 */
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { submitGenerativeVideo } from '@/lib/services/ai/video/generation-service';
import { METHOD_CARDS } from '@/lib/services/ai/video/cards/method-cards';
import { MODIFIER_CHIPS } from '@/lib/services/ai/video/cards/modifier-chips';
import { getBrandFragment } from '@/lib/services/ai/video/cards/brand-cards';
import { VIDEO_MODELS } from '@/lib/services/ai/video/registry';
import { quotaSnapshot } from '@/lib/services/ai/video/quota';
import { mediaLibraryService } from '@/lib/services/media-library';
import { generateImage } from '@/lib/services/ai/image-generation';
import { getAIProvider } from '@/lib/ai/providers';
import { modelForTask } from '@/lib/services/ai/video/llm-routing';
import { InitiatedBy } from '@/lib/services/ai/video/types';

export interface ToolContext {
  userId: string;
  organizationId: string;
  initiatedBy: InitiatedBy;
}

export interface StudioTool {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  execute: (
    args: unknown,
    ctx: ToolContext
  ) => Promise<Record<string, unknown>>;
}

const GenerateVideoArgs = z.object({
  prompt: z.string().min(3).max(1000),
  imageUrl: z.string().url().optional(),
  methodCardId: z.string().min(1),
  modifierIds: z.array(z.string()).max(12).optional(),
  brandCardId: z.string().optional(),
  audio: z.boolean().optional(),
  variants: z.number().int().min(1).max(8).optional(),
  modelTier: z.enum(['draft', 'standard', 'premium']).optional(),
  aspectRatio: z.enum(['9:16', '1:1', '16:9']).optional(),
  durationSeconds: z.number().int().min(4).max(10).optional(),
});

export const STUDIO_TOOLS: StudioTool[] = [
  {
    name: 'list_cards',
    description:
      'List method cards, modifier chips, the org brand card, model tiers with costs and capability profiles, and current quota state.',
    schema: z.object({}),
    execute: async (_args, ctx) => ({
      methodCards: METHOD_CARDS,
      modifierChips: MODIFIER_CHIPS,
      brandCard: (await getBrandFragment(ctx.organizationId))
        ? { organizationId: ctx.organizationId }
        : null,
      models: VIDEO_MODELS,
      quota: await quotaSnapshot(ctx.organizationId),
    }),
  },
  {
    name: 'generate_video',
    description:
      'Submit a generative video job (async — returns job ids immediately; poll get_job). Defaults: draft tier, 9:16, 6s, 1 variant. Premium tier must be explicit.',
    schema: GenerateVideoArgs,
    execute: async (args, ctx) => {
      const a = GenerateVideoArgs.parse(args);
      const jobs = await submitGenerativeVideo({ ...a, ...ctx });
      const quota = await quotaSnapshot(ctx.organizationId);
      return { jobs, budgetWarning: quota.warning };
    },
  },
  {
    name: 'generate_image',
    description:
      'Generate an image via the existing image service (Stability/DALL-E/Gemini).',
    schema: z.object({
      prompt: z.string().min(3).max(1000),
      style: z.string().optional(),
      aspectRatio: z.enum(['9:16', '1:1', '16:9']).optional(),
    }),
    execute: async (args, ctx) => {
      const a = z
        .object({
          prompt: z.string(),
          style: z.string().optional(),
          aspectRatio: z.string().optional(),
        })
        .parse(args);
      // NOTE: match the real export of lib/services/ai/image-generation.ts —
      // check its signature before wiring (it is a live, working service).
      const result = await generateImage({
        prompt: a.prompt,
        style: a.style,
        aspectRatio: a.aspectRatio,
        userId: ctx.userId,
      });
      return { result };
    },
  },
  {
    name: 'get_job',
    description:
      'Fetch one video job by id (status, videoUrl when rendered, error when failed). Org-scoped.',
    schema: z.object({ id: z.string().min(1) }),
    execute: async (args, ctx) => {
      const { id } = z.object({ id: z.string() }).parse(args);
      const job = await prisma.videoGeneration.findFirst({
        where: { id, organizationId: ctx.organizationId },
        select: {
          id: true,
          status: true,
          videoUrl: true,
          errorMessage: true,
          model: true,
          batchGroupId: true,
          estimatedCostUsd: true,
          actualCostUsd: true,
          createdAt: true,
        },
      });
      return { job };
    },
  },
  {
    name: 'list_jobs',
    description:
      'List recent generative video jobs for the org, optionally by batchGroupId.',
    schema: z.object({
      batchGroupId: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    execute: async (args, ctx) => {
      const a = z
        .object({
          batchGroupId: z.string().optional(),
          limit: z.number().optional(),
        })
        .parse(args);
      const jobs = await prisma.videoGeneration.findMany({
        where: {
          organizationId: ctx.organizationId,
          mode: 'generative',
          ...(a.batchGroupId ? { batchGroupId: a.batchGroupId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: a.limit ?? 20,
        select: {
          id: true,
          status: true,
          videoUrl: true,
          methodCardId: true,
          batchGroupId: true,
          createdAt: true,
        },
      });
      return { jobs };
    },
  },
  {
    name: 'search_media_library',
    description:
      'Search the media library (e.g. find an image asset to use as I2V input).',
    schema: z.object({
      search: z.string().min(1),
      type: z.enum(['image', 'video', 'audio']).optional(),
    }),
    execute: async (args, ctx) => {
      const a = z
        .object({
          search: z.string(),
          type: z.enum(['image', 'video', 'audio']).optional(),
        })
        .parse(args);
      const assets = await mediaLibraryService.getAssets(ctx.userId, {
        search: a.search,
        type: a.type,
        limit: 20,
      });
      return { assets };
    },
  },
  {
    name: 'draft_caption',
    description:
      'Draft a platform caption for a rendered video using the cheap-LLM routing. Does NOT publish.',
    schema: z.object({
      jobId: z.string().min(1),
      platform: z.enum([
        'instagram',
        'tiktok',
        'linkedin',
        'facebook',
        'youtube',
      ]),
    }),
    execute: async (args, ctx) => {
      const a = z
        .object({ jobId: z.string(), platform: z.string() })
        .parse(args);
      const job = await prisma.videoGeneration.findFirst({
        where: { id: a.jobId, organizationId: ctx.organizationId },
        select: { inputPrompt: true, enhancedPrompt: true, methodCardId: true },
      });
      if (!job) return { caption: null, error: 'job not found' };
      const ai = getAIProvider();
      const res = await ai.complete({
        model: modelForTask('caption-draft'),
        messages: [
          {
            role: 'system',
            content: `Write one ${a.platform} caption for a short video. Match platform norms (hashtags for instagram/tiktok, professional for linkedin). Max 80 words. Australian English. No preamble.`,
          },
          {
            role: 'user',
            content: `Video: ${job.enhancedPrompt ?? job.inputPrompt}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      });
      return { caption: res.choices[0]?.message?.content?.trim() ?? null };
    },
  },
];

export async function executeStudioTool(
  name: string,
  args: unknown,
  ctx: ToolContext
): Promise<Record<string, unknown>> {
  const tool = STUDIO_TOOLS.find(t => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  tool.schema.parse(args); // throw zod error before any side effect
  return tool.execute(args, ctx);
}
```

NOTE on the two `// NOTE` integration points: before finalizing, check the real export names — `grep -n "export" lib/services/ai/image-generation.ts | head -20` and `grep -n "async getAssets" lib/services/media-library.ts`. Match their actual signatures; the test mocks isolate these, so adjust the wrappers (not the tests) to reality.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/video-engine/studio-tools.test.ts`
Expected: PASS (5 tests). The test mocks image-generation implicitly via module mock if import errors occur — if jest fails resolving `@/lib/services/ai/image-generation`, add `jest.mock('@/lib/services/ai/image-generation', () => ({ generateImage: jest.fn() }));` to the test top.

- [ ] **Step 5: Commit**

```bash
git add lib/services/ai/studio-tools __tests__/video-engine/studio-tools.test.ts
git commit -m "feat(video): typed studio tool layer - single contract for REST/MCP/copilot"
```

---

### Task 12: MCP server endpoint

**Files:**

- Create: `app/api/mcp/[transport]/route.ts`
- Modify: `package.json` (add dependency)
- Test: `__tests__/video-engine/mcp-route.test.ts`

- [ ] **Step 1: Install `mcp-handler`**

Run: `npm install mcp-handler@latest`
Expected: added to dependencies without peer conflicts (it supports Next.js App Router; if the proxy blocks npm, retry with the repo's `.npmrc` settings — they already handle the proxy).

- [ ] **Step 2: Write the failing auth test**

Full MCP handshake testing is brittle in jest; test our auth + tool wiring seam instead — extract it to a helper so the route file stays thin.

`__tests__/video-engine/mcp-route.test.ts`:

```typescript
import { resolveOrgFromBearer } from '@/app/api/mcp/auth';

describe('MCP bearer auth', () => {
  beforeEach(() => {
    process.env.SYNTHEX_MCP_KEYS = JSON.stringify({
      'key-abc': {
        organizationId: 'org1',
        userId: 'u-mcp',
        label: 'claude-code',
      },
    });
  });

  it('maps a known bearer key to its org context', () => {
    expect(resolveOrgFromBearer('Bearer key-abc')).toEqual({
      organizationId: 'org1',
      userId: 'u-mcp',
      label: 'claude-code',
    });
  });

  it('returns null for unknown or missing keys', () => {
    expect(resolveOrgFromBearer('Bearer nope')).toBeNull();
    expect(resolveOrgFromBearer(null)).toBeNull();
    expect(resolveOrgFromBearer('key-abc')).toBeNull(); // must be Bearer scheme
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then write `app/api/mcp/auth.ts`**

Run: `npm test -- __tests__/video-engine/mcp-route.test.ts` → FAIL (module not found).

```typescript
/**
 * MCP bearer-key auth. Phase 1: static keys in env, each mapped to an org.
 * SYNTHEX_MCP_KEYS = {"<key>": {"organizationId": "...", "userId": "...", "label": "..."}}
 */
export interface McpCaller {
  organizationId: string;
  userId: string;
  label: string;
}

export function resolveOrgFromBearer(
  authHeader: string | null
): McpCaller | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const key = authHeader.slice('Bearer '.length);
  try {
    const keys = JSON.parse(process.env.SYNTHEX_MCP_KEYS ?? '{}') as Record<
      string,
      McpCaller
    >;
    return keys[key] ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Write `app/api/mcp/[transport]/route.ts`**

```typescript
/**
 * MCP server — exposes the studio tool layer to external agents (Claude Code,
 * Unite-Hub, scheduled runs) over streamable HTTP. Identical quota/validation
 * paths as the UI; jobs tagged initiatedBy: 'mcp'. NO publish tools (phase 1).
 *
 * Client config (.mcp.json):
 *   { "synthex-studio": { "type": "http", "url": "https://<host>/api/mcp/mcp",
 *     "headers": { "Authorization": "Bearer <key>" } } }
 */
import { createMcpHandler } from 'mcp-handler';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  STUDIO_TOOLS,
  executeStudioTool,
} from '@/lib/services/ai/studio-tools';
import { resolveOrgFromBearer } from '../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildHandler(caller: { organizationId: string; userId: string }) {
  return createMcpHandler(
    server => {
      for (const tool of STUDIO_TOOLS) {
        server.tool(
          tool.name,
          tool.description,
          // mcp-handler accepts a zod raw shape; tools defined with z.object expose .shape
          (tool.schema as z.AnyZodObject).shape ?? {},
          async (args: Record<string, unknown>) => {
            const result = await executeStudioTool(tool.name, args, {
              userId: caller.userId,
              organizationId: caller.organizationId,
              initiatedBy: 'mcp',
            });
            return {
              content: [{ type: 'text', text: JSON.stringify(result) }],
            };
          }
        );
      }
    },
    {},
    { basePath: '/api/mcp' }
  );
}

async function handle(request: NextRequest) {
  const caller = resolveOrgFromBearer(request.headers.get('authorization'));
  if (!caller) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
    });
  }
  return buildHandler(caller)(request);
}

export { handle as GET, handle as POST, handle as DELETE };
```

NOTE: `mcp-handler`'s exact API may differ by version (check `node_modules/mcp-handler/README.md` after install — tool registration is `server.tool(name, description, schemaShape, cb)` in current versions). Adjust to the installed version; the auth seam and the executeStudioTool wiring are the contract this plan owns.

- [ ] **Step 5: Run tests + type-check**

Run: `npm test -- __tests__/video-engine/mcp-route.test.ts; npm run type-check`
Expected: PASS (2 tests); clean type-check.

- [ ] **Step 6: Manual handshake verification (local)**

Run: `npm run dev` (port 3008), then in another shell:

```bash
npx @modelcontextprotocol/inspector --cli http://localhost:3008/api/mcp/mcp --transport http --header "Authorization: Bearer key-abc" --method tools/list
```

(set `SYNTHEX_MCP_KEYS` in `.env.local` first). Expected: the 7 studio tools listed. Record the output in the commit message body.

- [ ] **Step 7: Commit**

```bash
git add app/api/mcp package.json package-lock.json __tests__/video-engine/mcp-route.test.ts
git commit -m "feat(video): MCP server exposing studio tools with bearer-key org auth"
```

---

### Task 13: Env wiring, feature flag, live smoke test, final verification

**Files:**

- Modify: `.env.example`
- Create: `scripts/video-smoke-test.ts`

- [ ] **Step 1: Add env documentation to `.env.example`**

Append (match the file's existing comment style):

```bash
# --- Generative Video Engine (spec 2026-06-11) ---
FAL_API_KEY=                       # fal.ai API key (SECRET)
FAL_WEBHOOK_SECRET=                # random 32+ char token authenticating fal webhooks (SECRET)
VIDEO_STUDIO_ENABLED=false         # feature flag for the studio + engine
VIDEO_MCP_DAILY_FRACTION=0.5       # MCP share of an org's daily video budget
SYNTHEX_MCP_KEYS={}                # JSON map: key -> {organizationId,userId,label} (SECRET)
# LLM_ROUTING_* overrides (optional): LLM_ROUTING_PROMPT_ENHANCE, LLM_ROUTING_CAPTION_DRAFT, ...
```

Feature flag enforcement: in `app/api/video/generate/route.ts`, at the top of the generative branch added in Task 8, insert:

```typescript
if (process.env.VIDEO_STUDIO_ENABLED !== 'true') {
  return APISecurityChecker.createSecureResponse(
    {
      success: false,
      error: 'Video studio is not enabled (VIDEO_STUDIO_ENABLED)',
    },
    403
  );
}
```

and set `process.env.VIDEO_STUDIO_ENABLED = 'true'` in the `beforeEach` of `__tests__/video-engine/generate-route.test.ts`.

- [ ] **Step 2: Write the live smoke test script**

`scripts/video-smoke-test.ts` — per proof-discipline, GREEN for this plan requires ONE real generation traversing submit → webhook → storage → media library. Env-gated; costs ≈ $0.30 (Wan 2.5, 6s).

```typescript
/**
 * LIVE smoke test — spends ~$0.30 on fal (Wan 2.5, 6s). Run manually:
 *   npx tsx scripts/video-smoke-test.ts
 * Requires: FAL_API_KEY, FAL_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL (publicly
 * reachable for the webhook — use the Vercel preview URL or a tunnel),
 * DATABASE_URL, VIDEO_SMOKE_ORG_ID, VIDEO_SMOKE_USER_ID.
 */
import prisma from '../lib/prisma';
import { submitGenerativeVideo } from '../lib/services/ai/video/generation-service';

async function main() {
  for (const k of [
    'FAL_API_KEY',
    'FAL_WEBHOOK_SECRET',
    'VIDEO_SMOKE_ORG_ID',
    'VIDEO_SMOKE_USER_ID',
  ]) {
    if (!process.env[k]) throw new Error(`${k} required — refusing to run`);
  }

  const [job] = await submitGenerativeVideo({
    userId: process.env.VIDEO_SMOKE_USER_ID!,
    organizationId: process.env.VIDEO_SMOKE_ORG_ID!,
    initiatedBy: 'studio',
    prompt: 'a steaming coffee cup on a workbench, morning light',
    methodCardId: 'lifestyle-broll',
    modelTier: 'draft',
    durationSeconds: 6,
  });
  console.log(
    `submitted: row=${job.id} fal=${job.providerJobId} est=$${job.estimatedCostUsd}`
  );

  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 15000));
    const row = await prisma.videoGeneration.findUnique({
      where: { id: job.id },
    });
    console.log(`  status=${row?.status}`);
    if (row?.status === 'rendered') {
      console.log(
        `PASS — videoUrl=${row.videoUrl} actual=$${row.actualCostUsd}`
      );
      process.exit(0);
    }
    if (row?.status === 'failed') {
      console.error(`FAIL — ${row.errorMessage}`);
      process.exit(1);
    }
  }
  console.error('FAIL — timed out after 10 minutes');
  process.exit(1);
}

main();
```

- [ ] **Step 3: Full verification gate**

Run, in order:

```
npm test -- __tests__/video-engine
npm run type-check
npm run lint
```

Expected: all video-engine suites PASS (≈36 tests), type-check clean, lint clean (`--max-warnings 0`). Fix anything that fails before proceeding.

- [ ] **Step 4: Live smoke test (requires deployed/tunneled webhook + human-provided FAL_API_KEY)**

Run: `npx tsx scripts/video-smoke-test.ts`
Expected: `PASS — videoUrl=https://…supabase…/generated-videos/…mp4`. If FAL_API_KEY is not yet provisioned, STOP and flag for the human — do not mark this plan complete without the live pass (proof-discipline: mocks alone are not GREEN).

- [ ] **Step 5: Final commit**

```bash
git add .env.example scripts/video-smoke-test.ts app/api/video/generate/route.ts __tests__/video-engine/generate-route.test.ts
git commit -m "feat(video): feature flag, env docs, live smoke test - engine complete"
```

---

## Out of scope for this plan (Plan 2: Studio UI + copilot rail)

`app/(dashboard)/video-studio/` page (canvas zones, friction requirements F1–F6), the copilot rail with `set_canvas`/`propose_batch`/`explain_estimate` UI-state tools, spend panel, and recipes. Plan 2 is written after this plan executes, against the real tool-layer contracts.

## Dependencies & human-gated items

1. **FAL_API_KEY** — provision at fal.ai (top-up credit, ~$10 covers all testing).
2. **FAL_WEBHOOK_SECRET** — generate locally: `node -e "console.log(crypto.randomBytes(24).toString('hex'))"`.
3. **`generated-videos` Supabase storage bucket** (public read) on the Synthex project.
4. **Migration to production DB** — Task 1 applies to dev only; prod migration goes through the repo's `db:migrate:production` flow with backup.
5. **Webhook reachability** — fal must reach `/api/video/webhook/fal`; use the Vercel deployment URL in `NEXT_PUBLIC_APP_URL` for the smoke test.
