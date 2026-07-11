#!/usr/bin/env tsx
/**
 * Carpet-style LoRA training CLI — I/O wrapper around scripts/lib/lora-train-core
 * (pure plan/spend-math/registry-entry logic lives there; this file does all I/O:
 * webp->jpg conversion, zip build, fal.storage upload, queue submit/poll,
 * atomic registry write). Spec: docs/superpowers/specs/2026-07-11-carpet-style-lora-design.md (§5, §9).
 *
 * Modes:
 *   (no flags)                        plan-print — ZERO spend, exit 0
 *   --confirm-spend [--steps N] [--id X]   stage -> zip -> upload -> train -> write registry
 *   --recover <request_id>            finish a run whose process died after submit
 *   --retire <id> --reason "…"        tombstone a registry entry (never deletes)
 *
 * `@fal-ai/client` is imported dynamically (inside the functions that need it,
 * not at module top-level) so importing `parseArgs`/`formatPlan` for tests never
 * touches the fal SDK or the network.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { Manifest } from '@/lib/services/ai/reference-library';
import {
  planDataset,
  oversample,
  captionFileName,
  costUsd,
  validateSteps,
  buildRegistryEntry,
  retireLora,
  type DatasetItem,
} from './lib/lora-train-core';
import {
  type TrainedLora,
  type TrainedLoraRegistry,
} from '@/lib/services/ai/image/trained-loras';

// Run from the repo root (`npx tsx scripts/train-carpet-style-lora.ts`). cwd-anchored
// because `__dirname` doesn't exist under tsx/ESM and `import.meta` doesn't parse
// under Jest's CJS transform — cwd is the repo root in both contexts (mirrors
// scripts/ingest-ccw-catalogue.ts).
const ROOT = process.cwd();
const LIB_DIR = path.join(ROOT, 'public/reference-library');
const MANIFEST_PATH = path.join(LIB_DIR, 'manifest.json');
const REGISTRY_PATH = path.join(
  ROOT,
  'lib/services/ai/image/trained-loras.json'
);
const RUNS_DIR = path.join(ROOT, '.lora-runs');

const TRAINER_MODEL = 'fal-ai/flux-2-trainer-v2';
const LEARNING_RATE = 0.00005;
const DEFAULT_STEPS = 1000;
const DEFAULT_ID = 'carpet-style-v1';
const POLL_INTERVAL_MS = 15_000;
const POLL_TIMEOUT_MS = 45 * 60_000;

// --- CLI args ---------------------------------------------------------------

export interface CliArgs {
  confirmSpend: boolean;
  steps: number;
  id: string;
  recover?: string;
  retire?: { id: string; reason: string };
}

export function parseArgs(argv: string[]): CliArgs {
  const a: CliArgs = {
    confirmSpend: false,
    steps: DEFAULT_STEPS,
    id: DEFAULT_ID,
  };
  let retireId: string | undefined;
  let retireReason: string | undefined;
  let i = 0;
  const nextValue = (flag: string): string => {
    i++;
    const v = argv[i];
    if (v === undefined) throw new Error(`missing value for ${flag}`);
    return v;
  };
  for (; i < argv.length; i++) {
    const f = argv[i];
    if (f === '--confirm-spend') a.confirmSpend = true;
    else if (f === '--steps') a.steps = Number(nextValue(f));
    else if (f === '--id') a.id = nextValue(f);
    else if (f === '--recover') a.recover = nextValue(f);
    else if (f === '--retire') retireId = nextValue(f);
    else if (f === '--reason') retireReason = nextValue(f);
    else throw new Error(`unknown flag: ${f}`);
  }
  if (retireId !== undefined) {
    if (!retireReason) throw new Error('--retire requires --reason "…"');
    a.retire = { id: retireId, reason: retireReason };
  }
  return a;
}

// --- plan report (pure — no fs/network) --------------------------------------

export interface Plan {
  /** Owned carpet-cleaning images before oversampling (the real dataset size). */
  imageCount: number;
  /** Oversampled items — one zip image + one caption file per entry. */
  items: DatasetItem[];
  steps: number;
}

export function formatPlan(plan: Plan): string {
  const entryCount = plan.items.length * 2; // image + caption per zip item
  const samples = plan.items.slice(0, 3).map(i => i.caption);
  return [
    `dataset: ${plan.imageCount} images (oversampled to ${plan.items.length} zip images)`,
    `zip entries: ${entryCount} (${plan.items.length} images + ${plan.items.length} captions)`,
    'sample captions:',
    ...samples.map(c => `  - ${c}`),
    `steps: ${plan.steps}`,
    `cost: $${costUsd(plan.steps).toFixed(2)}`,
  ].join('\n');
}

// --- small I/O helpers --------------------------------------------------------

function readManifest(): Manifest {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
}

function readRegistry(): TrainedLoraRegistry {
  return JSON.parse(
    fs.readFileSync(REGISTRY_PATH, 'utf8')
  ) as TrainedLoraRegistry;
}

/** Exported for tests (registry write atomicity, tmp-file cleanup) — not used
 * as a general-purpose write helper elsewhere; production callers still go
 * through the module-level REGISTRY_PATH. */
export function writeRegistryAtomic(
  reg: TrainedLoraRegistry,
  registryPath: string = REGISTRY_PATH
): void {
  const tmp = `${registryPath}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(reg, null, 2)}\n`);
  fs.renameSync(tmp, registryPath);
}

/** REFUSE if id exists — never overwrite (§5.6). Exported for tests. */
export function insertRegistryEntry(
  reg: TrainedLoraRegistry,
  entry: TrainedLora
): TrainedLoraRegistry {
  if (reg.loras.some(l => l.id === entry.id)) {
    throw new Error(
      `registry already has an entry with id "${entry.id}" — never overwrite (pick a new --id, e.g. "${entry.id}-v2")`
    );
  }
  return { ...reg, loras: [...reg.loras, entry] };
}

function replaceExt(basename: string, ext: string): string {
  const dot = basename.lastIndexOf('.');
  return dot === -1 ? `${basename}${ext}` : `${basename.slice(0, dot)}${ext}`;
}

function describeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function isEnoent(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: string }).code === 'ENOENT'
  );
}

function requireFalApiKey(): string {
  const key = process.env.FAL_API_KEY;
  if (!key) {
    console.error(
      'FAL_API_KEY is not set — required for fal.ai upload/training/recovery. Set it and retry.'
    );
    process.exit(1);
  }
  return key;
}

function extractFileUrl(value: unknown, field: string): string {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { url?: unknown }).url === 'string'
  ) {
    return (value as { url: string }).url;
  }
  throw new Error(`fal training result missing "${field}" url`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- .lora-runs/<request_id>.json — pending-run recovery state ---------------
// Written right after queue.submit (before polling) so "money spent, process
// died" is always recoverable via --recover. Repo-root, gitignored (§ fold).

interface PendingRun {
  id: string;
  steps: number;
  trainedAt: string;
  sourceImages: TrainedLora['sourceImages'];
}

function pendingRunPath(requestId: string): string {
  return path.join(RUNS_DIR, `${requestId}.json`);
}

function writePendingRun(requestId: string, run: PendingRun): void {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  const p = pendingRunPath(requestId);
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(run, null, 2)}\n`);
  fs.renameSync(tmp, p);
}

function readPendingRun(requestId: string): PendingRun {
  const p = pendingRunPath(requestId);
  if (!fs.existsSync(p)) {
    throw new Error(
      `no pending run found for request_id "${requestId}" at ${p} — was --confirm-spend run for this id on this machine?`
    );
  }
  return JSON.parse(fs.readFileSync(p, 'utf8')) as PendingRun;
}

function deletePendingRun(requestId: string): void {
  const p = pendingRunPath(requestId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// --- fal queue polling ---------------------------------------------------------

async function pollUntilComplete(requestId: string): Promise<void> {
  const { fal } = await import('@fal-ai/client');
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let seenLogs = 0;
  for (;;) {
    const status = await fal.queue.status(TRAINER_MODEL, {
      requestId,
      logs: true,
    });
    const logs =
      'logs' in status && Array.isArray(status.logs) ? status.logs : [];
    for (const line of logs.slice(seenLogs)) {
      console.log(`[fal ${requestId}] ${line.message}`);
    }
    seenLogs = logs.length;
    if (status.status === 'COMPLETED') return;
    if (Date.now() >= deadline) {
      throw new Error(
        `polling exceeded the ${POLL_TIMEOUT_MS / 60_000}-minute timeout — the job may still finish on fal's side; check the fal dashboard, then --recover ${requestId}`
      );
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

/** Fetch the fal result + build/write the registry entry. Shared by the normal
 * confirm-spend flow and --recover. */
async function finalizeRegistryEntry(
  requestId: string,
  pending: PendingRun
): Promise<void> {
  const { fal } = await import('@fal-ai/client');
  fal.config({ credentials: requireFalApiKey() });

  const result = await fal.queue.result(TRAINER_MODEL, { requestId });
  const data = result.data as Record<string, unknown>;
  const loraUrl = extractFileUrl(
    data.diffusers_lora_file,
    'diffusers_lora_file'
  );
  const configUrl = extractFileUrl(data.config_file, 'config_file');

  const entry = buildRegistryEntry({
    id: pending.id,
    steps: pending.steps,
    loraUrl,
    configUrl,
    falRequestId: requestId,
    trainedAt: pending.trainedAt,
    sourceImages: pending.sourceImages,
  });

  const next = insertRegistryEntry(readRegistry(), entry);
  writeRegistryAtomic(next);
  deletePendingRun(requestId);
  console.log(
    `registry entry written: ${entry.id} (loraUrl=${entry.loraUrl}, imageCount=${entry.imageCount}, costUsd=${entry.costUsd})`
  );
}

// --- confirm-spend ------------------------------------------------------------

async function runConfirmSpend(steps: number, id: string): Promise<void> {
  validateSteps(steps);
  // Fail fast on both preconditions before any local work or spend.
  requireFalApiKey();
  if (readRegistry().loras.some(l => l.id === id)) {
    throw new Error(
      `registry already has an entry with id "${id}" — refuse before spending; pick a new --id (e.g. "${id}-v2")`
    );
  }

  const manifest = readManifest();
  const base = planDataset(manifest);
  const items = oversample(base);
  console.log(
    `staging ${items.length} zip images (${base.length} unique, oversampled) + captions...`
  );

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lora-train-'));
  const stagedFiles: string[] = [];
  for (const item of items) {
    const srcPath = path.join(LIB_DIR, item.path);
    const jpgName = replaceExt(item.basename, '.jpg');
    const jpgPath = path.join(tmpDir, jpgName);
    await sharp(srcPath).jpeg({ quality: 95 }).toFile(jpgPath);
    const captionPath = path.join(tmpDir, captionFileName(jpgName));
    fs.writeFileSync(captionPath, item.caption);
    stagedFiles.push(jpgPath, captionPath);
  }

  const zipPath = path.join(tmpDir, 'dataset.zip');
  try {
    execFileSync('zip', ['-j', zipPath, ...stagedFiles]);
  } catch (e) {
    if (isEnoent(e)) {
      console.error(
        'the `zip` command was not found on PATH — install it (e.g. `brew install zip` / `apt-get install zip`) and retry. Zero spend so far.'
      );
    } else {
      console.error(
        `zip build failed: ${describeError(e)}. Zero spend so far.`
      );
    }
    process.exitCode = 1;
    return;
  }

  // sourceImages is keyed on the UNIQUE (pre-oversample) dataset — matches the
  // printed plan count — hashing the corresponding staged JPG (deterministic,
  // so any oversampled duplicate would hash identically anyway).
  const sourceImages = base.map(item => {
    const jpgName = replaceExt(item.basename, '.jpg');
    const bytes = fs.readFileSync(path.join(tmpDir, jpgName));
    return {
      path: item.path,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      vendorKey: item.vendorKey,
    };
  });

  const zipBytes = fs.readFileSync(zipPath);
  const { fal } = await import('@fal-ai/client');
  fal.config({ credentials: requireFalApiKey() });

  console.log('uploading dataset zip to fal storage...');
  const imageDataUrl = await fal.storage.upload(new Blob([zipBytes]));

  const submitted = await fal.queue.submit(TRAINER_MODEL, {
    input: {
      image_data_url: imageDataUrl,
      steps,
      learning_rate: LEARNING_RATE,
    },
  });
  const requestId = submitted.request_id;
  // Print IMMEDIATELY — this line is what survives any later crash.
  console.log(`request_id: ${requestId}`);

  const trainedAt = new Date().toISOString().slice(0, 10);
  const pending: PendingRun = { id, steps, trainedAt, sourceImages };
  writePendingRun(requestId, pending);
  console.log(
    `pending run recorded at ${pendingRunPath(requestId)} — if this process dies, recover with:\n  npx tsx scripts/train-carpet-style-lora.ts --recover ${requestId}`
  );

  try {
    await pollUntilComplete(requestId);
  } catch (e) {
    console.error(`training did not complete: ${describeError(e)}`);
    console.error(
      `money has been spent — recover later with: npx tsx scripts/train-carpet-style-lora.ts --recover ${requestId}`
    );
    process.exitCode = 1;
    return;
  }

  try {
    await finalizeRegistryEntry(requestId, pending);
  } catch (e) {
    console.error(
      `training completed but the registry write failed: ${describeError(e)}`
    );
    console.error(
      `recover with: npx tsx scripts/train-carpet-style-lora.ts --recover ${requestId}`
    );
    process.exitCode = 1;
  }
}

// --- recover / retire ----------------------------------------------------------

async function runRecover(requestId: string): Promise<void> {
  const pending = readPendingRun(requestId);
  if (readRegistry().loras.some(l => l.id === pending.id)) {
    throw new Error(
      `registry already has an entry with id "${pending.id}" — refuse (nothing to recover)`
    );
  }
  await finalizeRegistryEntry(requestId, pending);
}

function runRetire(id: string, reason: string): void {
  const today = new Date().toISOString().slice(0, 10);
  const next = retireLora(readRegistry(), id, reason, today);
  writeRegistryAtomic(next);
  const entry = next.loras.find(l => l.id === id)!;
  const vendors = [...new Set(entry.sourceImages.map(s => s.vendorKey))];
  console.log(
    [
      `retired "${id}" (tombstone — loraUrl + sourceImages retained, never deleted)`,
      `  reason: ${reason}`,
      `  retiredAt: ${entry.retiredAt}`,
      `  loraUrl: ${entry.loraUrl}`,
      `  sourceImages: ${entry.sourceImages.length} (vendors: ${vendors.join(', ')})`,
    ].join('\n')
  );
}

// --- main ------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.retire) {
    runRetire(args.retire.id, args.retire.reason);
    return;
  }
  if (args.recover) {
    await runRecover(args.recover);
    return;
  }
  if (args.confirmSpend) {
    await runConfirmSpend(args.steps, args.id);
    return;
  }

  // Default: plan-print, ZERO spend.
  const manifest = readManifest();
  const base = planDataset(manifest);
  const items = oversample(base);
  console.log(
    formatPlan({ imageCount: base.length, items, steps: args.steps })
  );
}

// Run only when invoked directly (not when imported by tests). Uses the argv
// check rather than `require.main` so it works under tsx/ESM (mirrors
// scripts/ingest-ccw-catalogue.ts).
if (process.argv[1]?.endsWith('train-carpet-style-lora.ts')) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
