# Carpet-Style LoRA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Train a carpet-industry style LoRA on the 163-image owned corpus (fal `flux-2-trainer-v2`, $25.50 gated) and wire it into generation — pure-LoRA and LoRA+references compose — behind an opt-in `loraId`.

**Architecture:** A committed-empty, **non-public** trained-LoRA registry (bundled import) + a pure training core + an I/O CLI (webp→jpg zip with source-differentiated captions + 3× first-party oversample → fal storage → trainer queue with `--recover`) + a `/lora` `/lora/edit` adapter + `generateImage(loraId?)` with observable fail-open and metadata-carried lineage.

**Tech Stack:** TypeScript, `npx tsx`, `@fal-ai/client` (devDep), `sharp` (present), system `zip` binary, Jest.

**Spec:** `docs/superpowers/specs/2026-07-11-carpet-style-lora-design.md` (v2 — binding; 32 findings folded).

## Global Constraints

- npm; gate `npm run type-check && npm run lint && npm test`; no `any`; Australian English.
- **Registry path `lib/services/ai/image/trained-loras.json` — NEVER under `public/`** (LoRA URLs must not be CDN-served).
- Registry bootstrap: committed as `{ "version": 1, "loras": [] }` in the code PR — build/tests pass with zero entries.
- Cost math: **$0.0255 × steps**; cap **$26.00**; steps 100–1000, multiples of 100 only; default 1000 = $25.50.
- Captions: catalogue → `"<label>, product photo on white background, ccwcarpet style"`; first-party → `"<label>, on-site job photo, ccwcarpet style"`; first-party oversampled 3× via `-dupN` basenames; caption file = `ROOT.txt` for `ROOT.jpg` (extension REPLACED).
- Fail-open (observable): any loraId resolution failure → proceed without LoRA, result + `result.metadata` BOTH carry `loraRequested`, `loraApplied:false`; success → `loraApplied:true, loraId, triggerToken` in both.
- Selection: models with `loras:true` are EXCLUDED from all existing selection paths; chosen only via `selectImageModel({ needsLora: true })`.
- Retirement: TOMBSTONE (`status:'retired'`) — never delete entries; resolver accepts `status==='active'` only.
- No new MCP tool; `generate_image` gains ONE optional `loraId` Zod arg (update its schema tests).

---

### Task 1: Trained-LoRA registry (bootstrap file + module)

**Files:**

- Create: `lib/services/ai/image/trained-loras.json` — exactly `{ "version": 1, "loras": [] }`
- Create: `lib/services/ai/image/trained-loras.ts`
- Test: `tests/unit/ai/trained-loras.test.ts`

**Interfaces (produces — later tasks import these exact names):**

```ts
export interface TrainedLora {
  id: string;
  kind: 'style' | 'identity';
  industry: string;
  triggerToken: string;
  loraUrl: string;
  configUrl: string;
  trainedAt: string;
  steps: number;
  learningRate: number;
  costUsd: number;
  imageCount: number;
  falRequestId: string;
  status: 'active' | 'retired';
  retiredAt?: string;
  retiredReason?: string;
  sourceImages: Array<{ path: string; sha256: string; vendorKey: string }>;
}
export interface TrainedLoraRegistry {
  version: number;
  loras: TrainedLora[];
}
export const trainedLoraSchema: z.ZodType<TrainedLora>; // zod validation
export function resolveLora(id: string): TrainedLora | null; // bundled import; ACTIVE only
export function findLorasForVendor(
  registry: TrainedLoraRegistry,
  vendorKey: string
): TrainedLora[];
```

- [ ] **Step 1: failing tests** — `resolveLora` returns null on empty registry / unknown id; `findLorasForVendor` finds entries whose `sourceImages[].vendorKey` matches (fixture registry with 2 loras, one retired); retired entries are NOT resolved by `resolveLora` but ARE returned by `findLorasForVendor` (audit sees everything); `trainedLoraSchema` rejects an entry missing `loraUrl`.
- [ ] **Step 2:** run → fail. **Step 3:** implement (bundled `import registryData from './trained-loras.json'`, cast via schema-safe parse; same Vercel-safe pattern as the manifest). **Step 4:** run → pass; type-check. **Step 5:** commit `feat(ai): trained-LoRA registry (bootstrap, resolver, vendor audit query)`.

---

### Task 2: `/lora` + `/lora/edit` adapter

**Files:**

- Create: `lib/services/ai/image/providers/flux-lora-fal.ts`
- Test: `tests/unit/ai/flux-lora-fal.test.ts`

**Interfaces:** `generateFluxLoraImage({ prompt, loras: Array<{path: string; scale?: number}>, imageUrls?: string[], seed?: number }): Promise<{ imageUrl: string; seed?: number; model: string }>` — no `imageUrls` → `POST https://fal.run/fal-ai/flux-2/lora`; with → `POST https://fal.run/fal-ai/flux-2/lora/edit` (body adds `image_urls`). `loras` passed verbatim (omit `scale` when undefined). Same `Authorization: Key ${FAL_API_KEY}`, 60s timeout, error-with-body idiom as `flux-fal.ts` (copy that file's structure).

- [ ] Steps: failing tests (endpoint choice both branches asserted on URL AND body incl. `loras` verbatim + `image_urls` presence/absence; missing FAL_API_KEY throws; non-OK throws) → implement → pass → type-check → commit `feat(ai): FLUX.2 dev LoRA adapter (t2i + edit compose)`.

---

### Task 3: Registry entry + selection + `generateImage(loraId?)` + tool arg

**Files:**

- Modify: `lib/services/ai/image/registry.ts` (capability `loras: boolean` on `ImageModel`; new entry `fal-ai/flux-2/lora` `{provider:'fal', tier:'standard', grounding:true, loras:true}`; `selectImageModel` gains `needsLora?: boolean` — when true return the loras-capable entry; ALL other paths filter `!m.loras`)
- Modify: `lib/services/ai/image-generation.ts` (options `loraId?: string`; result fields + metadata carriage per Global Constraints; routing: loraId resolved+refs → adapter `/lora/edit` with both; loraId only → `/lora`; refs only → existing flux-2-pro path byte-identical; trigger-token warning appended to `result.warnings` and log)
- Modify: `lib/services/ai/studio-tools/index.ts` (`GenerateImageArgs` + `loraId: z.string().min(1).optional()`, threaded)
- Tests: extend `tests/unit/ai/image-registry.test.ts`, `tests/unit/ai/image-generation-grounding.test.ts` (mock `trained-loras.ts` + the new adapter), and the generate_image schema test file that asserts arg acceptance.

- [ ] Steps (TDD): failing tests — selection exclusion regression (`needsReferences` NEVER returns the loras entry; `needsLora` does); loraId success routing `/lora` with `loras:[{path}]` + `loraApplied:true` in result AND metadata; compose case `/lora/edit` receives `image_urls` + `loras` and result carries BOTH lineages; unknown loraId → fail-open `loraApplied:false` + generation proceeds (legacy path); retired lora id → same fail-open; trigger-token warning in `result.warnings`; tool accepts `loraId` → implement → pass → full three suites + type-check → commit `feat(ai): opt-in LoRA inference (loraId) with observable fail-open + compose`.

---

### Task 4: Training core (pure)

**Files:**

- Create: `scripts/lib/lora-train-core.ts`
- Test: `tests/unit/marketing-agency/lora-train-core.test.ts`

**Interfaces:**

```ts
export interface DatasetItem { path: string; basename: string; caption: string; vendorKey: string; firstParty: boolean }
export function planDataset(m: Manifest): DatasetItem[]            // throws on missing label; carpet-cleaning owned only
export function oversample(items: DatasetItem[], factor?: number): DatasetItem[] // firstParty 3x -> '-dupN' basenames
export function captionFileName(imageBasename: string): string      // ROOT.jpg -> ROOT.txt (replace ext)
export function costUsd(steps: number): number                      // 0.0255 * steps, 2dp
export function validateSteps(steps: number): void                  // 100..1000, %100===0, cost<=26 — throws otherwise
export function buildRegistryEntry(args: {…}): TrainedLora          // full shape incl. status:'active'
export function retireLora(reg: TrainedLoraRegistry, id: string, reason: string, date: string): TrainedLoraRegistry // tombstone, never delete; throws on unknown/already-retired
```

First-party detection: manifest subject `provenance.source !== 'ccw-shopify'` (or missing provenance) → firstParty. vendorKey from provenance (`'unite-group'` fallback for first-party).

- [ ] Steps: failing tests per function (incl.: plan excludes non-owned, aborts on missing label; oversample 25→75 with `-dup1..3` names and captions preserved; `validateSteps(1100)` throws at $28.05 > cap, `validateSteps(950)` throws non-multiple, `validateSteps(1000)` ok at 25.5; retireLora keeps loraUrl+sourceImages and flips status; buildRegistryEntry validates against `trainedLoraSchema`) → implement → pass → commit `feat(scripts): LoRA training pure core (dataset, captions, spend gate, tombstone)`.

---

### Task 5: Training CLI

**Files:**

- Create: `scripts/train-carpet-style-lora.ts`
- Modify: `package.json` (+ devDependency `@fal-ai/client@^1` — reason: fal storage upload + training queue; script-only, zero prod-bundle impact)
- Test: `tests/unit/marketing-agency/lora-train-cli.test.ts` (parseArgs + plan-report formatting only)

**Behaviour (I/O wrapper over core; follow `ingest-ccw-catalogue.ts` idioms — cwd ROOT, atomic writes):**

1. Modes: default plan-print (ZERO spend — plan, caption samples, zip contents count, exact cost, exit 0); `--confirm-spend [--steps N]`; `--recover <request_id>`; `--retire <id> --reason "…"`.
2. Confirm-spend path: `planDataset` → `oversample` → stage temp dir (webp→**jpg q95** via sharp + `ROOT.txt` captions) → `zip -j` (system binary; error clearly if missing) → `fal.storage.upload` (`@fal-ai/client`) → `fal.queue.submit('fal-ai/flux-2-trainer-v2', { image_data_url, steps, learning_rate: 0.00005 })` → **print request_id IMMEDIATELY** → poll `fal.queue.status` w/ logs until done → `fal.queue.result` → `buildRegistryEntry` (sha256 computed from the staged JPG bytes) → atomic write into `lib/services/ai/image/trained-loras.json`.
3. `--recover <id>`: `fal.queue.result` → registry write (idempotent: refuse if id exists).
4. Failure: any error after submit leaves registry untouched and prints the request_id + recover hint. ESM note: use the `process.argv[1]?.endsWith(...)` entry-guard idiom (NOT `require.main`); if `@fal-ai/client` import fails under tsx, fall back to raw-fetch upload/queue per fal HTTP docs (isolated helpers).

- [ ] Steps: failing tests (parseArgs modes incl. missing-value throws; report format includes count/cost/caption samples) → implement → tests + type-check + lint → commit `feat(scripts): carpet-style LoRA training CLI (gated spend, recover, retire)`.

---

### Task 6: Gate + code PR (ships BEFORE training)

- [ ] Full gate: `npm run type-check && npm run lint && npm test` — paste `Tests:` line.
- [ ] Plan-print run (zero spend): `npx tsx scripts/train-carpet-style-lora.ts` → paste (expect 163 images → 213 zip entries, $25.50 @1000).
- [ ] Commit any strays; push; PR (auto-merge → deploy). LoRA-less prod is safe (fail-open).

### Task 7: EXECUTE training (founder-authorised $25.50) + registry PR

- [ ] `npx tsx scripts/train-carpet-style-lora.ts --confirm-spend` → paste request_id + completion; registry gains `carpet-style-v1`.
- [ ] Gate green; commit registry entry; push; PR #2 (diff MUST contain the entry). Deploy.

### Task 8: Proofs (prod)

- [ ] **Proof A:** `generate_image {prompt:"a professional carpet cleaning setup in a hotel corridor, ccwcarpet style", loraId:"carpet-style-v1"}` → `loraApplied:true`, view image (founder eyeball; style-collapse check).
- [ ] **Proof B:** + `referenceSet:"carpet-cleaning"` → `/lora/edit` compose; both lineages in result; view.
- [ ] **Retirement drill:** `findLorasForVendor` against the real registry for a CCW vendorKey AND a manifest-pruned vendorKey → both find `carpet-style-v1`. Paste output.
- [ ] **Fail-open proof:** `loraId:"does-not-exist"` → `loraApplied:false`, generation still succeeds.

---

## Self-Review

**Spec coverage:** §5→Tasks 4-5; §6→Tasks 1-3; §7→Tasks 1,4 + Task 8 drill; §8 tests→each task; §9 runbook→Tasks 6-8; §10 ACs→Tasks 6-8 map 1:1. **Placeholders:** none — interfaces exact; CLI behaviour enumerated; the only prose-not-code areas (CLI internals) reference existing in-repo idioms by file. **Type consistency:** `TrainedLora`/`resolveLora`/`findLorasForVendor` (T1) consumed in T3/T4/T8; `generateFluxLoraImage` (T2) consumed in T3; `planDataset`/`oversample`/`validateSteps`/`buildRegistryEntry`/`retireLora` (T4) consumed in T5. `needsLora` selection name consistent across T3 code+tests.
