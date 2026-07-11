# Video Grounding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed video generation from the first owned reference photo (via the existing image-to-video path) so clips start from real CCW equipment instead of synthetic frames.

**Architecture:** Reuse everything. `submitGenerativeVideo` already takes an `imageUrl`, auto-selects an image-capable model when one is present, and passes it to fal. This slice resolves an owned reference into a local `seedImageUrl`, swaps the four `req.imageUrl` reads for it, and tags the returned jobs `grounded`. No new provider, registry, MCP tool, or migration.

**Tech Stack:** TypeScript, fal.ai (via existing adapter), Zod, Jest (`jest.worktree.cjs`).

**Spec:** `docs/superpowers/specs/2026-07-11-video-grounding-design.md`

## Global Constraints

- Package manager: **npm**. Full gate: `npm run type-check && npm run lint && npm test`.
- No `any` types; Australian English in product copy.
- **Owned-only** references (the resolver enforces it); **opt-in** grounding:
  `req.useReferences !== false && (req.useReferences === true || Boolean(req.referenceSet))`.
- **Explicit `imageUrl` wins**; a reference only fills an empty seed. `grounded` means "seeded
  from an owned reference set" — it stays `false` when the caller supplied their own `imageUrl`.
- **Fail-open:** any resolver error or empty `NEXT_PUBLIC_APP_URL` → proceed ungrounded
  (text-to-video); never hard-fail a submission.
- Reference URLs must be **absolute** (`NEXT_PUBLIC_APP_URL` + the site-relative path) — fal
  fetches them over the public internet.
- **No new MCP tool** is added, so the sandbox integration tool-count assertion is unaffected.
- No DB migration; `grounded` rides the in-memory `SubmittedJob` (`inputImageUrl` already persists the seed).

---

### Task 1: Grounding in `submitGenerativeVideo` (+ types)

**Files:**

- Modify: `lib/services/ai/video/types.ts` (`GenerativeVideoRequest`, `SubmittedJob`)
- Modify: `lib/services/ai/video/generation-service.ts` (resolution step + `seedImageUrl` swap + job tags)
- Test: `tests/unit/ai/video-grounding.test.ts`

**Interfaces:**

- Consumes: `resolveReferences({ set?, prompt? })` from `@/lib/services/ai/reference-library`
  → `{ industry: string | null; subject: string | null; imagePaths: string[]; count: number }`.
- Produces: `GenerativeVideoRequest` gains `referenceSet?: string`, `useReferences?: boolean`;
  `SubmittedJob` gains `grounded?: boolean`, `referenceSet?: string`.

- [ ] **Step 1: Add the new fields to the types**

In `lib/services/ai/video/types.ts`, add to `GenerativeVideoRequest` (after `durationSeconds?`):

```ts
  referenceSet?: string; // owned reference set id (e.g. 'carpet-cleaning')
  useReferences?: boolean; // opt-in: ground the I2V seed from the reference library
```

Add to `SubmittedJob` (after `status`):

```ts
  grounded?: boolean; // true when the seed came from an owned reference set
  referenceSet?: string; // the industry key the seed was drawn from
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/unit/ai/video-grounding.test.ts
import { submitGenerativeVideo } from '@/lib/services/ai/video/generation-service';
import type { GenerativeVideoRequest } from '@/lib/services/ai/video/types';

// Hermetic: no fal, no DB, no spend, no real manifest.
jest.mock('@/lib/services/ai/video/fal-adapter', () => ({
  submitToFal: jest.fn(async () => 'prov-1'),
}));
jest.mock('@/lib/services/ai/video/quota', () => ({
  holdQuota: jest.fn(async () => {}),
  releaseQuota: jest.fn(async () => {}),
}));
jest.mock('@/lib/services/ai/video/cards/method-cards', () => ({
  getMethodCard: jest.fn(() => ({
    id: 'stub',
    name: 'Stub',
    requiresImage: false,
  })),
}));
jest.mock('@/lib/services/ai/video/cards/modifier-chips', () => ({
  getChips: jest.fn(() => []),
}));
jest.mock('@/lib/services/ai/video/cards/brand-cards', () => ({
  getBrandFragment: jest.fn(async () => null),
}));
jest.mock('@/lib/services/ai/video/cards/compose', () => ({
  composePrompt: jest.fn(() => ({ prompt: 'composed', params: {} })),
}));
jest.mock('@/lib/services/ai/video/prompt-enhancer', () => ({
  enhancePrompt: jest.fn(async (p: string) => p),
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    videoGeneration: { create: jest.fn(async () => ({ id: 'row-1' })) },
  },
}));
jest.mock('@/lib/services/ai/reference-library', () => ({
  resolveReferences: jest.fn(),
}));

import { submitToFal } from '@/lib/services/ai/video/fal-adapter';
import { resolveReferences } from '@/lib/services/ai/reference-library';

const CARPET = {
  industry: 'carpet-cleaning',
  subject: 'carpet-cleaning-wand',
  imagePaths: [
    '/reference-library/carpet-cleaning/carpet-cleaning-wand-01.webp',
  ],
  count: 1,
};

function baseReq(
  over: Partial<GenerativeVideoRequest> = {}
): GenerativeVideoRequest {
  return {
    userId: 'u1',
    organizationId: 'o1',
    initiatedBy: 'studio',
    prompt: 'a carpet cleaning wand on office carpet',
    methodCardId: 'stub',
    ...over,
  };
}

const APP = 'https://synthex.social';
const lastFalInput = () =>
  (submitToFal as jest.Mock).mock.calls.at(-1)?.[1] as Record<string, unknown>;

describe('video grounding', () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = APP;
    (resolveReferences as jest.Mock).mockReturnValue(CARPET);
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });

  it('grounds the I2V seed from an explicit referenceSet', async () => {
    const jobs = await submitGenerativeVideo(
      baseReq({ referenceSet: 'carpet-cleaning' })
    );
    expect(lastFalInput().image_url).toBe(`${APP}${CARPET.imagePaths[0]}`);
    expect(jobs[0].grounded).toBe(true);
    expect(jobs[0].referenceSet).toBe('carpet-cleaning');
  });

  it('lets an explicit imageUrl win over a referenceSet (grounded=false)', async () => {
    const jobs = await submitGenerativeVideo(
      baseReq({
        imageUrl: 'https://x/seed.png',
        referenceSet: 'carpet-cleaning',
      })
    );
    expect(lastFalInput().image_url).toBe('https://x/seed.png');
    expect(jobs[0].grounded).not.toBe(true);
    expect(resolveReferences).not.toHaveBeenCalled();
  });

  it('does NOT ground a bare prompt (no set, no useReferences)', async () => {
    const jobs = await submitGenerativeVideo(baseReq());
    expect(lastFalInput().image_url).toBeUndefined();
    expect(jobs[0].grounded).not.toBe(true);
    expect(resolveReferences).not.toHaveBeenCalled();
  });

  it('grounds via auto-detect when useReferences:true', async () => {
    const jobs = await submitGenerativeVideo(baseReq({ useReferences: true }));
    expect(lastFalInput().image_url).toBe(`${APP}${CARPET.imagePaths[0]}`);
    expect(jobs[0].grounded).toBe(true);
  });

  it('treats useReferences:false as a hard opt-out even with a referenceSet', async () => {
    const jobs = await submitGenerativeVideo(
      baseReq({ referenceSet: 'carpet-cleaning', useReferences: false })
    );
    expect(lastFalInput().image_url).toBeUndefined();
    expect(jobs[0].grounded).not.toBe(true);
  });

  it('fails open (ungrounded) when NEXT_PUBLIC_APP_URL is unset', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const jobs = await submitGenerativeVideo(
      baseReq({ referenceSet: 'carpet-cleaning' })
    );
    expect(lastFalInput().image_url).toBeUndefined();
    expect(jobs[0].grounded).not.toBe(true);
  });

  it('fails open (ungrounded, no throw) when the resolver throws', async () => {
    (resolveReferences as jest.Mock).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const jobs = await submitGenerativeVideo(
      baseReq({ referenceSet: 'carpet-cleaning' })
    );
    expect(lastFalInput().image_url).toBeUndefined();
    expect(jobs[0].grounded).not.toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/unit/ai/video-grounding.test.ts`
Expected: FAIL — `grounded`/`referenceSet` not returned; refs not resolved into `image_url`.

- [ ] **Step 4: Add the resolution step and swap `req.imageUrl` → `seedImageUrl`**

In `lib/services/ai/video/generation-service.ts`, immediately AFTER the variants validation
(after the `if (variants < 1 || variants > MAX_VARIANTS)` block) and BEFORE
`const methodCard = getMethodCard(...)`, insert:

```ts
// Reference grounding (opt-in, owned-only). Fill the I2V seed from an owned
// reference set when the caller opts in and provided no explicit imageUrl.
// Fail-open: any miss/error leaves the request ungrounded (text-to-video).
const useRefs =
  req.useReferences !== false &&
  (req.useReferences === true || Boolean(req.referenceSet));
let grounded = false;
let groundedSet: string | null = null;
let seedImageUrl = req.imageUrl; // explicit imageUrl always wins
if (useRefs && !seedImageUrl) {
  try {
    const { resolveReferences } =
      await import('@/lib/services/ai/reference-library');
    const refs = resolveReferences({
      set: req.referenceSet,
      prompt: req.prompt,
    });
    if (refs.count > 0) {
      const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
      if (base) {
        seedImageUrl = `${base}${refs.imagePaths[0]}`;
        grounded = true;
        groundedSet = refs.industry;
      } else {
        logger.warn(
          'video grounding skipped: NEXT_PUBLIC_APP_URL not configured'
        );
      }
    }
  } catch (e) {
    logger.warn('video grounding failed; proceeding ungrounded', { e });
  }
}
```

Then replace the four `req.imageUrl` reads with `seedImageUrl`:

- The method-card check: `if (methodCard.requiresImage && !seedImageUrl) {`
- The model resolve: `requiresImage: Boolean(seedImageUrl),`
- The fal input spread: `...(seedImageUrl ? { image_url: seedImageUrl } : {}),`
- The row persist: `inputImageUrl: seedImageUrl,`

Finally, tag each pushed job — change the `jobs.push({ ... })` object to include:

```ts
jobs.push({
  id: row.id,
  providerJobId,
  batchGroupId,
  model: model.id,
  estimatedCostUsd: perJobUsd,
  status: 'generating',
  grounded,
  referenceSet: groundedSet ?? undefined,
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/unit/ai/video-grounding.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Type-check + commit**

Run: `npm run type-check`
Expected: no errors.

```bash
git add lib/services/ai/video/types.ts lib/services/ai/video/generation-service.ts tests/unit/ai/video-grounding.test.ts
git commit -m "feat(video): ground I2V seed from owned reference set (opt-in, fail-open)"
```

---

### Task 2: `generate_video` studio-tool args

**Files:**

- Modify: `lib/services/ai/studio-tools/index.ts` (`GenerateVideoArgs` + `generate_video` description)
- Test: `tests/unit/ai/video-grounding-tool.test.ts`

**Interfaces:**

- Consumes: `GenerativeVideoRequest.referenceSet/useReferences` (Task 1).
- Produces: `generate_video` accepts `referenceSet?` / `useReferences?` (auto-threaded via
  `submitGenerativeVideo({ ...a, ...ctx })`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ai/video-grounding-tool.test.ts
import { z } from 'zod';

// Re-derive the arg schema shape by importing the module and checking the tool.
import { ALL_MCP_TOOLS } from '@/lib/services/ai/studio-tools';

describe('generate_video reference args', () => {
  it('accepts referenceSet and useReferences without error', () => {
    const tool = ALL_MCP_TOOLS.find(t => t.name === 'generate_video');
    expect(tool).toBeDefined();
    const parsed = (tool!.schema as z.ZodTypeAny).safeParse({
      prompt: 'a carpet wand',
      methodCardId: 'stub',
      referenceSet: 'carpet-cleaning',
      useReferences: true,
    });
    expect(parsed.success).toBe(true);
  });

  it('still rejects a missing prompt', () => {
    const tool = ALL_MCP_TOOLS.find(t => t.name === 'generate_video');
    const parsed = (tool!.schema as z.ZodTypeAny).safeParse({
      methodCardId: 'stub',
      referenceSet: 'carpet-cleaning',
    });
    expect(parsed.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/ai/video-grounding-tool.test.ts`
Expected: FAIL — `referenceSet`/`useReferences` are stripped/rejected (not in schema) OR the
first test fails because the schema doesn't yet allow the fields (depending on Zod strictness).

- [ ] **Step 3: Extend `GenerateVideoArgs` and the tool description**

In `lib/services/ai/studio-tools/index.ts`, add inside `GenerateVideoArgs = z.object({ ... })`
(after `durationSeconds`):

```ts
  referenceSet: z.string().min(1).optional(),
  useReferences: z.boolean().optional(),
```

Update the `generate_video` tool's `description` to append:

```
 Pass referenceSet (or useReferences:true) to seed the clip from an owned reference photo (real equipment) instead of a synthetic first frame.
```

No execute change is needed — the tool already calls
`submitGenerativeVideo({ ...a, ...ctx })`, so the parsed args flow through.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/ai/video-grounding-tool.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Type-check + commit**

Run: `npm run type-check`
Expected: no errors.

```bash
git add lib/services/ai/studio-tools/index.ts tests/unit/ai/video-grounding-tool.test.ts
git commit -m "feat(video): generate_video reference args (auto-threaded to grounding)"
```

---

### Task 3: Full gate + acceptance

**Files:** none (verification only).

- [ ] **Step 1: Run the full gate**

Run: `npm run type-check && npm run lint && npm test`
Expected: type-check clean; lint 0 warnings; `Tests:` line shows all suites passing incl. the two
new files. Paste the actual `Tests:` line. Confirm the sandbox integration suite's tool-count
assertion is untouched (this slice adds no MCP tool).

- [ ] **Step 2: Verify acceptance criteria (spec §10)**

- AC1 grounded seed → Task 1 test "grounds the I2V seed from an explicit referenceSet".
- AC2 explicit imageUrl wins → Task 1 test "lets an explicit imageUrl win".
- AC3 bare prompt unchanged → Task 1 test "does NOT ground a bare prompt".
- AC4 useReferences:false hard-off → Task 1 test.
- AC5 fail-open → Task 1 tests (empty APP_URL + resolver throws).
- AC6 gate green + no new MCP tool → Step 1.

- [ ] **Step 3: Note the live-verification follow-up (do NOT fake it)**

Record that the end-to-end grounded clip requires a **deployed** `NEXT_PUBLIC_APP_URL` (fal fetches
the seed over the public internet, and the video webhook already needs a public URL). Unit tests
mock fal; the visual check (a clip starting from the real wand) runs against a preview/prod deploy.

---

## Self-Review

**Spec coverage:** §4.1 types → Task 1 Step 1; §4.2 resolution step + `seedImageUrl` swap + job
tags → Task 1 Step 4; §4.3 tool args + description → Task 2; §6 governance (opt-in, owned-only via
resolver) → Task 1 gate formula + resolver; §7 error handling (fail-open, empty APP_URL) → Task 1
tests + Step 4 try/catch; §8 tests → Task 1 (7) + Task 2 (2); §9 risk (public-URL) → Task 3 Step 3;
§10 acceptance → Task 3 Step 2; §11 file list → Tasks 1–2. No gaps.

**Placeholder scan:** no TBD/TODO; every code step shows complete code; commands have expected output.

**Type consistency:** `resolveReferences(...)` returns `{ industry, subject, imagePaths, count }`
(matches the shipped resolver and is mocked identically in the test); `seedImageUrl` is the single
name used across all four swaps; `SubmittedJob.grounded/referenceSet` set in Task 1 Step 4 match
the fields added in Step 1 and asserted in the tests. `groundedSet` is `string | null`, coerced to
`undefined` for the optional `referenceSet` job field.
