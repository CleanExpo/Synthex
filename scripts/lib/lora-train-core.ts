/**
 * Carpet-style LoRA training — PURE core (no fs, no network). The CLI wrapper
 * (scripts/train-carpet-style-lora.ts) does all I/O: webp->jpg conversion,
 * zip build, fal.storage upload, queue submit/poll, atomic registry write.
 * Spec: docs/superpowers/specs/2026-07-11-carpet-style-lora-design.md (§5, L4).
 */
import type { Manifest } from '@/lib/services/ai/reference-library';
import {
  trainedLoraSchema,
  type TrainedLora,
  type TrainedLoraRegistry,
} from '@/lib/services/ai/image/trained-loras';

const INDUSTRY = 'carpet-cleaning';
const TRIGGER_TOKEN = 'ccwcarpet';
const LEARNING_RATE = 0.00005;
const COST_PER_STEP = 0.0255;
const SPEND_CAP_USD = 26;

export interface DatasetItem {
  path: string;
  basename: string;
  caption: string;
  vendorKey: string;
  firstParty: boolean;
}

/**
 * Builds the training-set plan from the reference-library manifest: every
 * OWNED carpet-cleaning subject that has images, one DatasetItem per image.
 * Source-differentiated captions (L4): CCW catalogue (ccw-shopify) images get
 * a "product photo" caption; everything else (first-party, or provenance
 * missing entirely) gets an "on-site job photo" caption and firstParty: true.
 * Missing/empty subject label aborts BEFORE spend — never silently skipped.
 */
export function planDataset(m: Manifest): DatasetItem[] {
  const industry = m.industries[INDUSTRY];
  const items: DatasetItem[] = [];

  if (industry) {
    for (const subject of Object.values(industry.subjects)) {
      if (subject.rights !== 'owned') continue;
      const images = subject.images ?? [];
      if (images.length === 0) continue;

      const label = subject.label?.trim();
      if (!label) {
        throw new Error(
          `lora-train-core: subject with missing/empty label in "${INDUSTRY}" — aborting before spend`
        );
      }

      const isCcwCatalogue = subject.provenance?.source === 'ccw-shopify';
      const vendorKey = subject.provenance?.vendorKey ?? 'unite-group';
      const caption = isCcwCatalogue
        ? `${label}, product photo on white background, ${TRIGGER_TOKEN} style`
        : `${label}, on-site job photo, ${TRIGGER_TOKEN} style`;

      for (const image of images) {
        items.push({
          path: `${INDUSTRY}/${image.file}`,
          basename: image.file,
          caption,
          vendorKey,
          firstParty: !isCcwCatalogue,
        });
      }
    }
  }

  if (items.length === 0) {
    throw new Error(
      `lora-train-core: dataset plan is empty for "${INDUSTRY}" — nothing to train on, aborting before spend`
    );
  }

  return items;
}

/** Insert a `-dupN`-style suffix immediately before the file extension. */
function insertBeforeExt(basename: string, suffix: string): string {
  const dot = basename.lastIndexOf('.');
  return dot === -1
    ? `${basename}${suffix}`
    : `${basename.slice(0, dot)}${suffix}${basename.slice(dot)}`;
}

/**
 * Rebalances the catalogue/job-photo skew (L4): every firstParty item is
 * duplicated so it appears `factor` times total (1 original + factor-1
 * dupes). Duplicates share the original's `path` (same source bytes) but get
 * a `-dupN`-suffixed basename so the zip build writes distinct copies.
 * Order: all originals first (input order), then all duplicates appended
 * (grouped by source item, then dup index) — deterministic.
 */
export function oversample(items: DatasetItem[], factor = 3): DatasetItem[] {
  const result: DatasetItem[] = [...items];
  const extraCopies = Math.max(0, factor - 1);

  for (const item of items) {
    if (!item.firstParty) continue;
    for (let n = 1; n <= extraCopies; n++) {
      result.push({
        ...item,
        basename: insertBeforeExt(item.basename, `-dup${n}`),
      });
    }
  }

  return result;
}

/** `ROOT.<ext>` -> `ROOT.txt` (extension REPLACED, not appended). */
export function captionFileName(imageBasename: string): string {
  const dot = imageBasename.lastIndexOf('.');
  return dot === -1
    ? `${imageBasename}.txt`
    : `${imageBasename.slice(0, dot)}.txt`;
}

/** fal `flux-2-trainer-v2` cost: $0.0255/step, rounded to 2dp. */
export function costUsd(steps: number): number {
  return Math.round(steps * COST_PER_STEP * 100) / 100;
}

/** Spend gate (L3): 100..1000 steps, must be a multiple of 100, cost <= $26. */
export function validateSteps(steps: number): void {
  if (steps < 100 || steps > 1000 || steps % 100 !== 0) {
    throw new Error(
      `lora-train-core: invalid steps ${steps} — must be between 100 and 1000, in multiples of 100`
    );
  }
  const cost = costUsd(steps);
  if (cost > SPEND_CAP_USD) {
    throw new Error(
      `lora-train-core: steps ${steps} costs $${cost} — exceeds the $${SPEND_CAP_USD} spend cap`
    );
  }
}

/**
 * Builds a full TrainedLora registry entry from a training run's outputs.
 * Fixed fields (kind, industry, triggerToken, learningRate, status) are the
 * slice-1 constants; costUsd/imageCount are derived. Validated against
 * trainedLoraSchema before returning — an entry that fails validation must
 * never reach the registry file.
 */
export function buildRegistryEntry(a: {
  id: string;
  steps: number;
  loraUrl: string;
  configUrl: string;
  falRequestId: string;
  trainedAt: string;
  sourceImages: TrainedLora['sourceImages'];
}): TrainedLora {
  const entry: TrainedLora = {
    id: a.id,
    kind: 'style',
    industry: INDUSTRY,
    triggerToken: TRIGGER_TOKEN,
    loraUrl: a.loraUrl,
    configUrl: a.configUrl,
    trainedAt: a.trainedAt,
    steps: a.steps,
    learningRate: LEARNING_RATE,
    costUsd: costUsd(a.steps),
    imageCount: a.sourceImages.length,
    falRequestId: a.falRequestId,
    status: 'active',
    sourceImages: a.sourceImages,
  };
  trainedLoraSchema.parse(entry);
  return entry;
}

/**
 * Tombstones a registry entry (§7 — never delete, keeps loraUrl +
 * sourceImages as the audit record). Returns a deep-copied registry; the
 * input registry is never mutated. Throws on unknown id or double-retire.
 */
export function retireLora(
  reg: TrainedLoraRegistry,
  id: string,
  reason: string,
  date: string
): TrainedLoraRegistry {
  // JSON round-trip deep-copy: the registry is plain JSON-safe data (no
  // Date/Map/etc.), and jsdom's test environment does not expose the global
  // structuredClone() that Node provides.
  const next: TrainedLoraRegistry = JSON.parse(JSON.stringify(reg));
  const entry = next.loras.find(l => l.id === id);
  if (!entry) {
    throw new Error(`lora-train-core: retireLora — unknown lora id "${id}"`);
  }
  if (entry.status === 'retired') {
    throw new Error(`lora-train-core: retireLora — "${id}" is already retired`);
  }
  entry.status = 'retired';
  entry.retiredAt = date;
  entry.retiredReason = reason;
  return next;
}
