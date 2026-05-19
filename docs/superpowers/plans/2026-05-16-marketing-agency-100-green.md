# Marketing Agency 100% Green Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Synthex Agentic Marketing Agency from planning docs into a tested dashboard module that can generate, QA, and export campaign packages without fake claims, unlicensed assets, or accidental ad spend.

**Architecture:** Proceed in thin vertical slices. Each slice adds one working capability, one focused test set, and one smoke path. Live provider integrations stay behind server-side adapter boundaries and credential gates until mock mode is fully green.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Supabase/Postgres, Jest, Playwright, Lighthouse CI, Remotion, existing Synthex dashboard/auth/organization primitives.

---

## Non-Negotiable Green Standard

Every task that touches code must finish with:

- `npm run type-check`
- `npm run lint`
- targeted Jest tests for the changed module
- a smoke command or route render check
- `git diff --check`

Every milestone must finish with:

- `npm test` or documented scoped alternative if full test suite is already red outside this work
- `npm run build`
- Playwright smoke for affected routes
- Lighthouse check for new user-facing routes when they exist
- no client-visible provider secrets
- no live publishing or ad-spend path

If a command fails:

1. Stop feature work.
2. Record the failing command and error.
3. Fix only the failure caused by this work.
4. Re-run the same command.
5. Continue only after it is green or clearly documented as pre-existing.

## Current Repo Truth

Marketing Agency is currently plan-first:

- Complete docs and policies exist in `docs/marketing-agency/`.
- Production briefs exist in `docs/marketing-agency/restoreassist-production/briefs/`.
- No Marketing Agency product routes, Prisma schema edits, migrations, provider adapters, or UI have been added yet.
- Existing Synthex primitives should be reused: `Organization`, `BrandDNA`, `Persona`, `Campaign`, `ApprovalRequest`, `WorkflowExecution`, `StepExecution`, `VideoGeneration`, `PlatformConnection`, SEO/GEO/E-E-A-T modules, publish safety code, and Remotion render tooling.

## File Map

Create or modify only these areas unless a task explicitly expands scope:

- Create: `lib/marketing-agency/types.ts`  
  Shared TypeScript contracts for campaign packages, evidence, claims, licences, QA, provider modes, and agent outputs.

- Create: `lib/marketing-agency/fixtures/restoreassist.ts`  
  Deterministic RestoreAssist fixture data for mock campaign generation.

- Create: `lib/marketing-agency/evidence.ts`  
  Claim classification and evidence-link validation.

- Create: `lib/marketing-agency/licensing.ts`  
  Asset licence validation and export blocking decisions.

- Create: `lib/marketing-agency/qa.ts`  
  Campaign package QA that combines evidence, consent, licence, format, and publish gates.

- Create: `lib/marketing-agency/orchestrator.ts`  
  Mock-mode campaign package generator using deterministic specialist outputs.

- Create: `lib/marketing-agency/export-manifest.ts`  
  JSON export package builder for scripts, storyboards, audio recommendations, QA results, and handoff notes.

- Create: `lib/marketing-agency/artlist/mock.ts`  
  Mock Artlist audio recommendations with pending licence status.

- Create: `lib/marketing-agency/remotion/scene-data.ts`  
  Structured scene data for RestoreAssist launch videos.

- Create: `app/api/marketing-agency/campaigns/route.ts`  
  Initial authenticated API route for creating a mock campaign package.

- Create: `app/dashboard/marketing-agency/page.tsx`  
  Dashboard entry page for campaign packages.

- Create: `app/dashboard/marketing-agency/restoreassist-launch/page.tsx`  
  RestoreAssist launch package review page.

- Create: `components/marketing-agency/*`  
  Focused presentation components for board memo, persona map, storyboard, QA gate, export manifest, and blocked reasons.

- Create tests under `tests/unit/marketing-agency/` and `tests/e2e/marketing-agency.spec.ts`.

- Modify: `docs/marketing-agency/*` only when implementation truth changes.

## Milestone 1: Baseline Green And Worktree Truth

**Success:** Know exactly what is green before implementation starts.

- [ ] **Step 1: Capture current git state**

Run:

```bash
git status --short
git branch --show-current
```

Expected:

- Branch is known.
- Existing untracked docs are acknowledged.
- No unrelated file is modified by this task.

- [ ] **Step 2: Run baseline validation**

Run:

```bash
npm run type-check
npm run lint
npm test -- --runInBand
npm run build
```

Expected:

- If green, record as baseline.
- If red, record exact failing commands in `docs/marketing-agency/IMPLEMENTATION-STATUS.md` before coding.

- [ ] **Step 3: Create implementation status log**

Create `docs/marketing-agency/IMPLEMENTATION-STATUS.md`:

```markdown
# Marketing Agency Implementation Status

## Baseline

- Date: 2026-05-16
- Branch:
- Typecheck:
- Lint:
- Tests:
- Build:

## Current Milestone

- Milestone: M1 Baseline
- Status: in_progress

## Known Pre-Existing Failures

- None recorded yet.

## Latest Green Commands

- None recorded yet.
```

- [ ] **Step 4: Commit docs-only baseline if requested**

Run only after user approval to commit:

```bash
git add docs/marketing-agency docs/superpowers/plans/2026-05-16-marketing-agency-100-green.md
git commit -m "docs: plan marketing agency green path"
```

Expected:

- Commit succeeds.

## Milestone 2: Domain Contracts And Deterministic Fixtures

**Success:** The agency has typed campaign package objects without touching the database.

- [ ] **Step 1: Write failing contract tests**

Create `tests/unit/marketing-agency/types.test.ts`:

```ts
import { restoreAssistFixture } from '@/lib/marketing-agency/fixtures/restoreassist';

describe('marketing agency fixtures', () => {
  it('contains the minimum source data required for a draft campaign', () => {
    expect(restoreAssistFixture.clientBrand.displayName).toBe('RestoreAssist');
    expect(restoreAssistFixture.productProfile.primaryOffer).toContain('3');
    expect(restoreAssistFixture.personas.length).toBeGreaterThanOrEqual(3);
    expect(restoreAssistFixture.sourceRefs.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx jest tests/unit/marketing-agency/types.test.ts --runInBand
```

Expected:

- FAIL because `@/lib/marketing-agency/fixtures/restoreassist` does not exist.

- [ ] **Step 3: Create shared types**

Create `lib/marketing-agency/types.ts` with these exports:

```ts
export type ProviderMode = 'mock' | 'live';

export type GateStatus = 'pass' | 'warn' | 'blocked';

export interface SourceRef {
  id: string;
  label: string;
  url?: string;
  path?: string;
  verifiedAt: string;
}

export interface ClientBrandProfile {
  id: string;
  slug: string;
  displayName: string;
  legalName?: string;
  websiteUrl: string;
  primaryAudience: string;
  secondaryAudience: string;
  voiceRules: string[];
  forbiddenClaims: string[];
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface ProductProfile {
  id: string;
  name: string;
  primaryOffer: string;
  valueProposition: string;
  proofPoints: string[];
  blockedClaims: string[];
}

export interface BuyerPersona {
  id: string;
  name: string;
  platformPriority: string;
  coreProblem: string;
  messageAngle: string;
  proofNeeded: string[];
  primaryCta: string;
}

export interface CampaignFixture {
  clientBrand: ClientBrandProfile;
  productProfile: ProductProfile;
  personas: BuyerPersona[];
  sourceRefs: SourceRef[];
}
```

- [ ] **Step 4: Create RestoreAssist fixture**

Create `lib/marketing-agency/fixtures/restoreassist.ts`:

```ts
import type { CampaignFixture } from '../types';

export const restoreAssistFixture: CampaignFixture = {
  clientBrand: {
    id: 'restoreassist',
    slug: 'ra',
    displayName: 'RestoreAssist',
    legalName: 'RestoreAssist Pty Ltd',
    websiteUrl: 'https://restoreassist.app',
    primaryAudience: 'Australian water-damage restoration tradies',
    secondaryAudience: 'Insurance claims teams and assessor networks',
    voiceRules: [
      'Australian-direct',
      'grounded',
      'informed',
      'short cadence',
      'client problem before product',
    ],
    forbiddenClaims: [
      'guaranteed time saved',
      'guaranteed claim approval',
      'guaranteed cost reduction',
      'fake testimonials',
    ],
    colors: {
      primary: '#1C2E47',
      secondary: '#8A6B4E',
      accent: '#D4A574',
    },
  },
  productProfile: {
    id: 'restoreassist-launch',
    name: 'RestoreAssist.app Launch',
    primaryOffer: 'Start with 3 free reports.',
    valueProposition:
      'RestoreAssist helps Australian restoration teams connect inspection, scoping, estimating, and reporting from verified site data.',
    proofPoints: [
      'inspection workflow',
      'scoping workflow',
      'estimating workflow',
      'verified site data',
      'transparent auditable reports',
      'PDF and Excel export',
    ],
    blockedClaims: [
      'guaranteed time saved',
      'guaranteed claim approval',
      'guaranteed re-inspection reduction',
    ],
  },
  personas: [
    {
      id: 'restoration-owner',
      name: 'Restoration Company Owner',
      platformPriority: 'LinkedIn first, Facebook retargeting second',
      coreProblem: 'Jobs move faster than admin capacity.',
      messageAngle: 'Inspection, scoping, and estimating in one repeatable process.',
      proofNeeded: ['workflow screenshots', 'pricing page', 'export proof'],
      primaryCta: 'Start with 3 reports.',
    },
    {
      id: 'field-technician',
      name: 'Field Technician / Supervisor',
      platformPriority: 'Facebook and LinkedIn',
      coreProblem: 'Site notes become office rework.',
      messageAngle: 'Capture the job once. Keep the report tied to the evidence.',
      proofNeeded: ['capture flow', 'photo fields', 'report export'],
      primaryCta: 'Try the workflow on the next job.',
    },
    {
      id: 'insurance-assessor',
      name: 'Insurance Adjuster / Assessor',
      platformPriority: 'LinkedIn',
      coreProblem: 'Reports arrive in inconsistent formats.',
      messageAngle: 'Transparent, auditable restoration reports from verified site data.',
      proofNeeded: ['sample report', 'compliance references', 'privacy statement'],
      primaryCta: 'Review a sample report.',
    },
  ],
  sourceRefs: [
    {
      id: 'restoreassist-site',
      label: 'RestoreAssist.app',
      url: 'https://restoreassist.app',
      verifiedAt: '2026-05-16',
    },
    {
      id: 'ra-brand-config',
      label: 'RestoreAssist brand config',
      path: 'packages/brand-config/src/brands/ra.ts',
      verifiedAt: '2026-05-16',
    },
  ],
};
```

- [ ] **Step 5: Verify the contract test passes**

Run:

```bash
npx jest tests/unit/marketing-agency/types.test.ts --runInBand
npm run type-check
git diff --check
```

Expected:

- PASS.

## Milestone 3: Evidence, Licensing, And QA Gates

**Success:** Unsupported claims and unlicensed assets are blocked before export.

- [ ] **Step 1: Write evidence tests**

Create `tests/unit/marketing-agency/qa.test.ts`:

```ts
import { evaluateClaimEvidence } from '@/lib/marketing-agency/evidence';
import { evaluateAssetLicences } from '@/lib/marketing-agency/licensing';
import { runCampaignQa } from '@/lib/marketing-agency/qa';

describe('marketing agency QA gates', () => {
  it('blocks factual claims without evidence references', () => {
    const result = evaluateClaimEvidence([
      {
        id: 'claim-1',
        text: 'RestoreAssist guarantees claim approval.',
        type: 'outcome',
        evidenceRefs: [],
      },
    ]);

    expect(result.status).toBe('blocked');
    expect(result.blockedReasons[0]).toContain('claim-1');
  });

  it('blocks unlicensed production assets', () => {
    const result = evaluateAssetLicences([
      {
        id: 'asset-1',
        assetType: 'audio',
        provider: 'artlist',
        licenceStatus: 'pending',
      },
    ]);

    expect(result.status).toBe('blocked');
    expect(result.blockedReasons[0]).toContain('asset-1');
  });

  it('keeps publishing blocked by default', () => {
    const result = runCampaignQa({
      claimGate: { status: 'pass', blockedReasons: [], warnings: [] },
      licenceGate: { status: 'pass', blockedReasons: [], warnings: [] },
      consentGate: { status: 'pass', blockedReasons: [], warnings: [] },
      formatGate: { status: 'pass', blockedReasons: [], warnings: [] },
      publishApproved: false,
    });

    expect(result.publishGate.status).toBe('blocked');
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npx jest tests/unit/marketing-agency/qa.test.ts --runInBand
```

Expected:

- FAIL because QA modules do not exist.

- [ ] **Step 3: Add QA types**

Append to `lib/marketing-agency/types.ts`:

```ts
export type ClaimType = 'factual' | 'outcome' | 'comparative' | 'subjective' | 'testimonial' | 'future-looking';

export interface CampaignClaim {
  id: string;
  text: string;
  type: ClaimType;
  evidenceRefs: string[];
}

export type LicenceStatus = 'unknown' | 'pending' | 'licensed' | 'rejected' | 'expired';

export interface CampaignAsset {
  id: string;
  assetType: 'image' | 'video' | 'audio' | 'voice' | 'generated';
  provider: string;
  providerAssetId?: string;
  sourceUrl?: string;
  licenceStatus: LicenceStatus;
}

export interface GateResult {
  status: GateStatus;
  blockedReasons: string[];
  warnings: string[];
}
```

- [ ] **Step 4: Implement evidence gate**

Create `lib/marketing-agency/evidence.ts`:

```ts
import type { CampaignClaim, GateResult } from './types';

const EVIDENCE_REQUIRED = new Set(['factual', 'outcome', 'comparative', 'testimonial']);

export function evaluateClaimEvidence(claims: CampaignClaim[]): GateResult {
  const blockedReasons = claims
    .filter((claim) => EVIDENCE_REQUIRED.has(claim.type) && claim.evidenceRefs.length === 0)
    .map((claim) => `Claim ${claim.id} requires evidence before export.`);

  return {
    status: blockedReasons.length > 0 ? 'blocked' : 'pass',
    blockedReasons,
    warnings: [],
  };
}
```

- [ ] **Step 5: Implement licence gate**

Create `lib/marketing-agency/licensing.ts`:

```ts
import type { CampaignAsset, GateResult } from './types';

export function evaluateAssetLicences(assets: CampaignAsset[]): GateResult {
  const blockedReasons = assets
    .filter((asset) => asset.licenceStatus !== 'licensed')
    .map((asset) => `Asset ${asset.id} is ${asset.licenceStatus}; licensed status is required.`);

  return {
    status: blockedReasons.length > 0 ? 'blocked' : 'pass',
    blockedReasons,
    warnings: [],
  };
}
```

- [ ] **Step 6: Implement campaign QA combiner**

Create `lib/marketing-agency/qa.ts`:

```ts
import type { GateResult } from './types';

export interface CampaignQaInput {
  claimGate: GateResult;
  licenceGate: GateResult;
  consentGate: GateResult;
  formatGate: GateResult;
  publishApproved: boolean;
}

export interface CampaignQaResult {
  claimGate: GateResult;
  licenceGate: GateResult;
  consentGate: GateResult;
  formatGate: GateResult;
  publishGate: GateResult;
  exportReady: boolean;
}

export function runCampaignQa(input: CampaignQaInput): CampaignQaResult {
  const publishGate: GateResult = input.publishApproved
    ? { status: 'pass', blockedReasons: [], warnings: [] }
    : {
        status: 'blocked',
        blockedReasons: ['Publishing and ad spend are blocked by default.'],
        warnings: [],
      };

  const gates = [input.claimGate, input.licenceGate, input.consentGate, input.formatGate];

  return {
    ...input,
    publishGate,
    exportReady: gates.every((gate) => gate.status === 'pass'),
  };
}
```

- [ ] **Step 7: Verify QA tests pass**

Run:

```bash
npx jest tests/unit/marketing-agency/qa.test.ts --runInBand
npm run type-check
git diff --check
```

Expected:

- PASS.

## Milestone 4: Mock Agency Orchestrator

**Success:** One RestoreAssist campaign package is generated end-to-end in mock mode.

- [ ] **Step 1: Write orchestrator test**

Create `tests/unit/marketing-agency/orchestrator.test.ts`:

```ts
import { generateMockCampaignPackage } from '@/lib/marketing-agency/orchestrator';

describe('generateMockCampaignPackage', () => {
  it('generates a RestoreAssist launch package with blocked publish gate', () => {
    const result = generateMockCampaignPackage({ providerMode: 'mock' });

    expect(result.providerMode).toBe('mock');
    expect(result.boardMemo.campaignObjective).toContain('RestoreAssist');
    expect(result.personas.length).toBeGreaterThanOrEqual(3);
    expect(result.storyboards.length).toBeGreaterThan(0);
    expect(result.qa.publishGate.status).toBe('blocked');
    expect(result.exportManifest.formats).toEqual(expect.arrayContaining(['16:9', '9:16', '4:5', '1:1']));
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npx jest tests/unit/marketing-agency/orchestrator.test.ts --runInBand
```

Expected:

- FAIL because orchestrator does not exist.

- [ ] **Step 3: Add package types**

Append to `lib/marketing-agency/types.ts`:

```ts
export interface BoardMemo {
  campaignObjective: string;
  targetPersona: string;
  creativeStrategy: string;
  evidenceGaps: string[];
  finalBoardDecision: 'draft' | 'blocked' | 'client-ready';
}

export interface StoryboardScene {
  index: number;
  startSec: number;
  endSec: number;
  onScreenText: string;
  voiceover: string;
  visualNote: string;
}

export interface CampaignStoryboard {
  id: string;
  title: string;
  channel: string;
  durationSec: number;
  scenes: StoryboardScene[];
}

export interface ExportManifest {
  campaignId: string;
  formats: string[];
  assets: CampaignAsset[];
  blockedReasons: string[];
}

export interface MockCampaignPackage {
  campaignId: string;
  providerMode: ProviderMode;
  boardMemo: BoardMemo;
  personas: BuyerPersona[];
  storyboards: CampaignStoryboard[];
  qa: import('./qa').CampaignQaResult;
  exportManifest: ExportManifest;
}
```

- [ ] **Step 4: Implement export manifest builder**

Create `lib/marketing-agency/export-manifest.ts`:

```ts
import type { CampaignAsset, ExportManifest, GateResult } from './types';

export function buildExportManifest(input: {
  campaignId: string;
  formats: string[];
  assets: CampaignAsset[];
  gates: GateResult[];
}): ExportManifest {
  return {
    campaignId: input.campaignId,
    formats: input.formats,
    assets: input.assets,
    blockedReasons: input.gates.flatMap((gate) => gate.blockedReasons),
  };
}
```

- [ ] **Step 5: Implement mock Artlist provider**

Create `lib/marketing-agency/artlist/mock.ts`:

```ts
import type { CampaignAsset } from '../types';

export function getMockArtlistAudioAsset(): CampaignAsset {
  return {
    id: 'mock-artlist-audio-restoreassist-001',
    assetType: 'audio',
    provider: 'artlist',
    providerAssetId: 'mock-song-001',
    sourceUrl: 'mock://artlist/song/mock-song-001',
    licenceStatus: 'pending',
  };
}
```

- [ ] **Step 6: Implement mock orchestrator**

Create `lib/marketing-agency/orchestrator.ts`:

```ts
import { getMockArtlistAudioAsset } from './artlist/mock';
import { restoreAssistFixture } from './fixtures/restoreassist';
import { evaluateAssetLicences } from './licensing';
import { runCampaignQa } from './qa';
import { buildExportManifest } from './export-manifest';
import type { GateResult, MockCampaignPackage, ProviderMode } from './types';

export function generateMockCampaignPackage(input: { providerMode: ProviderMode }): MockCampaignPackage {
  const audioAsset = getMockArtlistAudioAsset();
  const claimGate: GateResult = { status: 'pass', blockedReasons: [], warnings: [] };
  const licenceGate = evaluateAssetLicences([audioAsset]);
  const consentGate: GateResult = { status: 'pass', blockedReasons: [], warnings: [] };
  const formatGate: GateResult = { status: 'pass', blockedReasons: [], warnings: [] };
  const qa = runCampaignQa({
    claimGate,
    licenceGate,
    consentGate,
    formatGate,
    publishApproved: false,
  });

  const campaignId = 'restoreassist-launch-2026-05';

  return {
    campaignId,
    providerMode: input.providerMode,
    boardMemo: {
      campaignObjective:
        'Launch RestoreAssist.app with an evidence-led campaign for Australian restoration professionals.',
      targetPersona: restoreAssistFixture.personas[0].name,
      creativeStrategy:
        'Lead with job evidence and reporting friction before introducing RestoreAssist as the connected workflow.',
      evidenceGaps: [
        'Artlist licence evidence required before client-ready export.',
        'Product screenshots must be approved before final video export.',
      ],
      finalBoardDecision: 'blocked',
    },
    personas: restoreAssistFixture.personas,
    storyboards: [
      {
        id: 'linkedin-authority',
        title: 'LinkedIn Authority Explainer',
        channel: 'linkedin',
        durationSec: 90,
        scenes: [
          {
            index: 1,
            startSec: 0,
            endSec: 8,
            onScreenText: 'A restoration report needs to hold the job together.',
            voiceover: 'A restoration report needs to hold the job together.',
            visualNote: 'Field report fragments on navy background.',
          },
        ],
      },
    ],
    qa,
    exportManifest: buildExportManifest({
      campaignId,
      formats: ['16:9', '9:16', '4:5', '1:1'],
      assets: [audioAsset],
      gates: [claimGate, licenceGate, consentGate, formatGate, qa.publishGate],
    }),
  };
}
```

- [ ] **Step 7: Verify orchestrator passes**

Run:

```bash
npx jest tests/unit/marketing-agency/orchestrator.test.ts --runInBand
npm run type-check
git diff --check
```

Expected:

- PASS.
- Export is not client-ready because mock Artlist licence remains pending.

## Milestone 5: API Route In Mock Mode

**Success:** Authenticated server route can return a mock campaign package without provider credentials.

- [ ] **Step 1: Create API route**

Create `app/api/marketing-agency/campaigns/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { generateMockCampaignPackage } from '@/lib/marketing-agency/orchestrator';

export async function POST() {
  const campaignPackage = generateMockCampaignPackage({ providerMode: 'mock' });

  return NextResponse.json({
    ok: true,
    campaignPackage,
  });
}
```

- [ ] **Step 2: Add route test**

Create `tests/unit/marketing-agency/campaign-route.test.ts`:

```ts
import { POST } from '@/app/api/marketing-agency/campaigns/route';

describe('marketing agency campaign route', () => {
  it('returns a mock campaign package', async () => {
    const response = await POST();
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.campaignPackage.providerMode).toBe('mock');
    expect(body.campaignPackage.qa.publishGate.status).toBe('blocked');
  });
});
```

- [ ] **Step 3: Verify route test passes**

Run:

```bash
npx jest tests/unit/marketing-agency/campaign-route.test.ts --runInBand
npm run type-check
git diff --check
```

Expected:

- PASS.

- [ ] **Step 4: Tighten auth before merge**

Before merging this route, replace the unauthenticated draft with the repo's existing auth helper pattern used by adjacent dashboard API routes. Run:

```bash
rg -n "getUser|requireAuth|createRouteHandlerClient|auth" app/api | head -n 80
```

Expected:

- Identify the local auth helper.
- Update `POST` to reject unauthenticated requests.
- Add a test for unauthenticated rejection if route helpers are mockable.

## Milestone 6: Dashboard Review UI

**Success:** Internal users can view the mock campaign package and blocked gates.

- [ ] **Step 1: Create presentation components**

Create:

- `components/marketing-agency/BoardMemoPanel.tsx`
- `components/marketing-agency/PersonaMapPanel.tsx`
- `components/marketing-agency/StoryboardPanel.tsx`
- `components/marketing-agency/QaGatePanel.tsx`
- `components/marketing-agency/ExportManifestPanel.tsx`

Each component accepts plain props from `MockCampaignPackage`; no fetching and no provider calls.

- [ ] **Step 2: Create dashboard route**

Create `app/dashboard/marketing-agency/restoreassist-launch/page.tsx`:

```tsx
import { BoardMemoPanel } from '@/components/marketing-agency/BoardMemoPanel';
import { ExportManifestPanel } from '@/components/marketing-agency/ExportManifestPanel';
import { PersonaMapPanel } from '@/components/marketing-agency/PersonaMapPanel';
import { QaGatePanel } from '@/components/marketing-agency/QaGatePanel';
import { StoryboardPanel } from '@/components/marketing-agency/StoryboardPanel';
import { generateMockCampaignPackage } from '@/lib/marketing-agency/orchestrator';

export default function RestoreAssistLaunchPage() {
  const campaignPackage = generateMockCampaignPackage({ providerMode: 'mock' });

  return (
    <main className="container mx-auto flex flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Marketing Agency
        </p>
        <h1 className="text-3xl font-bold">RestoreAssist Launch Package</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Mock-mode campaign package with evidence, licensing, QA, and export gates visible before provider integrations.
        </p>
      </header>

      <BoardMemoPanel memo={campaignPackage.boardMemo} />
      <PersonaMapPanel personas={campaignPackage.personas} />
      <StoryboardPanel storyboards={campaignPackage.storyboards} />
      <QaGatePanel qa={campaignPackage.qa} />
      <ExportManifestPanel manifest={campaignPackage.exportManifest} />
    </main>
  );
}
```

- [ ] **Step 3: Create index route**

Create `app/dashboard/marketing-agency/page.tsx` with a link to `/dashboard/marketing-agency/restoreassist-launch`.

- [ ] **Step 4: Add smoke test**

Create `tests/e2e/marketing-agency.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('marketing agency RestoreAssist package renders', async ({ page }) => {
  await page.goto('/dashboard/marketing-agency/restoreassist-launch');
  await expect(page.getByRole('heading', { name: 'RestoreAssist Launch Package' })).toBeVisible();
  await expect(page.getByText('Publishing and ad spend are blocked by default.')).toBeVisible();
});
```

- [ ] **Step 5: Verify UI**

Run:

```bash
npm run type-check
npm run lint
npx playwright test tests/e2e/marketing-agency.spec.ts
git diff --check
```

Expected:

- PASS or, if auth redirects dashboard routes in Playwright, update the test to use the repo's authenticated e2e pattern.

## Milestone 7: Remotion Scene Data And Draft Render Path

**Success:** RestoreAssist launch videos have structured scene data ready for render tooling.

- [ ] **Step 1: Create scene data**

Create `lib/marketing-agency/remotion/scene-data.ts`:

```ts
import type { CampaignStoryboard } from '../types';

export const restoreAssistLaunchStoryboards: CampaignStoryboard[] = [
  {
    id: 'ra-launch-linkedin-authority-2026-05',
    title: 'LinkedIn Authority Explainer',
    channel: 'linkedin',
    durationSec: 90,
    scenes: [
      {
        index: 1,
        startSec: 0,
        endSec: 8,
        onScreenText: 'A restoration report needs to hold the job together.',
        voiceover: 'A restoration report needs to hold the job together.',
        visualNote: 'Field report fragments on navy background.',
      },
      {
        index: 2,
        startSec: 8,
        endSec: 20,
        onScreenText: 'Photos. Readings. Scope. Estimate.',
        voiceover:
          'Photos, readings, scope notes, and cost lines all need to point back to verified site data.',
        visualNote: 'Inspection photos and notes align into a single record.',
      },
    ],
  },
];
```

- [ ] **Step 2: Add scene data test**

Create `tests/unit/marketing-agency/remotion-scene-data.test.ts`:

```ts
import { restoreAssistLaunchStoryboards } from '@/lib/marketing-agency/remotion/scene-data';

describe('RestoreAssist Remotion scene data', () => {
  it('has timed scenes with voiceover and visual notes', () => {
    const storyboard = restoreAssistLaunchStoryboards[0];

    expect(storyboard.durationSec).toBeGreaterThan(0);
    expect(storyboard.scenes[0].startSec).toBe(0);
    expect(storyboard.scenes.every((scene) => scene.voiceover && scene.visualNote)).toBe(true);
  });
});
```

- [ ] **Step 3: Verify scene data**

Run:

```bash
npx jest tests/unit/marketing-agency/remotion-scene-data.test.ts --runInBand
npm run type-check
git diff --check
```

Expected:

- PASS.

## Milestone 8: Persistence Foundation

**Success:** Campaign packages can be stored with tenant boundaries after mock engine is green.

- [ ] **Step 1: Re-open schema map**

Read:

```bash
sed -n '1,260p' docs/marketing-agency/schema-map.md
```

Expected:

- Confirm whether to extend existing `BrandDNA`, `Persona`, and `Campaign` or create wrapper models.

- [ ] **Step 2: Add additive Prisma models**

Modify `prisma/schema.prisma` only with additive organisation-scoped models. Required first models:

- `MarketingAgencyCampaign`
- `MarketingAgencySourceRef`
- `MarketingAgencyClaim`
- `MarketingAgencyAsset`
- `MarketingAgencyQaReport`
- `MarketingAgencyExportPackage`

Every model must include:

- `id`
- `organizationId`
- `createdById`
- `createdAt`
- `updatedAt`

- [ ] **Step 3: Validate schema**

Run:

```bash
npx prisma validate
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > /tmp/marketing-agency-schema.sql
```

Expected:

- Prisma validates.
- SQL contains no destructive drops.

- [ ] **Step 4: Add ownership tests**

Create tests that prove one organization cannot read another organization's marketing agency campaign records through the data-access layer.

- [ ] **Step 5: Verify persistence milestone**

Run:

```bash
npm run type-check
npm run lint
npx prisma validate
npm test -- --runInBand
git diff --check
```

Expected:

- PASS.

## Milestone 9: Provider Adapter Boundaries

**Success:** Artlist, HeyGen, and Meta are typed boundaries with mock defaults and live gates.

- [ ] **Step 1: Add Artlist interface**

Create:

- `lib/marketing-agency/artlist/types.ts`
- `lib/marketing-agency/artlist/recommend.ts`
- `lib/marketing-agency/artlist/client.ts`

Live client must throw a typed configuration error if credentials are missing.

- [ ] **Step 2: Add HeyGen interface**

Create:

- `lib/marketing-agency/heygen/types.ts`
- `lib/marketing-agency/heygen/mock.ts`
- `lib/marketing-agency/heygen/client.ts`

Live client must require consent metadata before any real-person likeness flow.

- [ ] **Step 3: Add Meta export interface**

Create:

- `lib/marketing-agency/meta/specs.ts`
- `lib/marketing-agency/meta/creative-checks.ts`
- `lib/marketing-agency/meta/export.ts`

No publish method is allowed in this milestone.

- [ ] **Step 4: Verify provider gates**

Run:

```bash
npm run type-check
npm run lint
npx jest tests/unit/marketing-agency --runInBand
git diff --check
```

Expected:

- PASS.
- Tests prove missing credentials do not block mock generation.
- Tests prove missing credentials block live provider calls.

## Milestone 10: Production Green Gate

**Success:** The module is ready for PR review and human sign-off.

- [ ] **Step 1: Full local gate**

Run:

```bash
npm run type-check
npm run lint
npm test -- --runInBand
npm run build
npx playwright test tests/e2e/marketing-agency.spec.ts
git diff --check
```

Expected:

- PASS.

- [ ] **Step 2: Browser smoke**

Start dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3008/dashboard/marketing-agency
http://localhost:3008/dashboard/marketing-agency/restoreassist-launch
```

Expected:

- Routes render.
- No console errors caused by the new module.
- Mock campaign package visible.
- Blocked publish gate visible.

- [ ] **Step 3: Lighthouse smoke**

Run existing Lighthouse workflow after adding the route target if required by `lighthouserc.js`.

Expected:

- Performance, accessibility, best practices, and SEO meet existing repo thresholds or any failure is documented and scoped.

- [ ] **Step 4: Final implementation report**

Create `docs/marketing-agency/IMPLEMENTATION-COMPLETION-REPORT.md`:

```markdown
# Marketing Agency Implementation Completion Report

## Scope Completed

- 

## Green Commands

- 

## Smoke Tests

- 

## Provider Mode

- Mock mode:
- Artlist live:
- HeyGen live:
- Meta publish/spend:

## Known Blockers

- 

## Production Recommendation

- 
```

Fill every bullet with actual results before sign-off.

## Continuous Execution Loop

After every completed task:

1. Update `docs/marketing-agency/IMPLEMENTATION-STATUS.md`.
2. Run the task's targeted verification command.
3. Run `git diff --check`.
4. Commit only if the user requested commits or the work is being prepared for PR.
5. Pick the next unchecked task only after the current task is green.

Daily or after every major milestone:

1. Run the full local gate.
2. Update blockers.
3. Keep live provider and paid publishing gates blocked unless explicitly approved.
4. Prefer the smallest next vertical slice that produces working software.

## Self-Review

- Spec coverage: The plan covers baseline, contracts, QA gates, mock engine, API, UI, Remotion data, persistence, providers, smoke testing, and final green gate.
- Placeholder scan: No task uses placeholder markers as implementation content. Later milestones intentionally define interfaces and verification commands because their exact code depends on earlier schema decisions.
- Type consistency: Core type names are introduced before use: `GateResult`, `CampaignAsset`, `MockCampaignPackage`, `CampaignStoryboard`, and `ExportManifest`.
