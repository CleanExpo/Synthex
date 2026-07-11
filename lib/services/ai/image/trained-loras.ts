/**
 * Trained-LoRA registry — single source of truth over
 * lib/services/ai/image/trained-loras.json. Registry is committed empty;
 * training runs populate it with entries. Returns active-only entries via
 * resolveLora; audit queries (findLorasForVendor) see retired entries too.
 *
 * The registry is BUNDLED (imported at build time), NOT read from the
 * filesystem — same Vercel-safe pattern as reference-library.ts. Serverless
 * functions do not include lib/ in their runtime fs, so bundled import makes
 * the registry available in every runtime context.
 */

import { z } from 'zod';

import { logger } from '@/lib/logger';

// Bundled import — makes the registry available in Vercel serverless + local
import registryData from './trained-loras.json';

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

export const trainedLoraSchema = z.object({
  id: z.string(),
  kind: z.enum(['style', 'identity']),
  industry: z.string(),
  triggerToken: z.string(),
  loraUrl: z.string(),
  configUrl: z.string(),
  trainedAt: z.string(),
  steps: z.number(),
  learningRate: z.number(),
  costUsd: z.number(),
  imageCount: z.number(),
  falRequestId: z.string(),
  status: z.enum(['active', 'retired']),
  retiredAt: z.string().optional(),
  retiredReason: z.string().optional(),
  sourceImages: z.array(
    z.object({
      path: z.string(),
      sha256: z.string(),
      vendorKey: z.string(),
    })
  ),
});

let cache: TrainedLoraRegistry | null = null;

function loadRegistry(): TrainedLoraRegistry {
  if (cache) return cache;
  // Bundled import — no filesystem access, works identically on Vercel
  // serverless and locally. Registry is fixed at build time (rebuilt on deploy),
  // which is intended behaviour for a curated LoRA corpus.
  const raw = registryData as unknown as {
    version?: number;
    loras?: unknown[];
  };
  const rawLoras = Array.isArray(raw.loras) ? raw.loras : [];
  const loras: TrainedLora[] = [];
  rawLoras.forEach((entry, index) => {
    const result = trainedLoraSchema.safeParse(entry);
    if (result.success) {
      loras.push(result.data);
      return;
    }
    // Fail-open: one malformed entry must never break resolution of the rest.
    const id =
      typeof entry === 'object' && entry !== null && 'id' in entry
        ? String((entry as { id?: unknown }).id)
        : `<unknown id at index ${index}>`;
    logger.warn('trained-loras: excluding invalid registry entry', {
      index,
      id,
      issues: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
    });
  });
  cache = { version: raw.version ?? 1, loras };
  return cache;
}

/**
 * Resolve a trained LoRA by ID from an already-loaded registry.
 * Pure — no I/O, no caching. Returns ONLY active entries; retired LoRAs are
 * excluded. Extracted from resolveLora() so tests can exercise the
 * active/retired split against a fixture registry without touching the
 * bundled JSON (mirrors resolveFromManifest in reference-library.ts).
 */
export function resolveLoraFrom(
  registry: TrainedLoraRegistry,
  id: string
): TrainedLora | null {
  const lora = registry.loras.find(l => l.id === id && l.status === 'active');
  return lora ?? null;
}

/**
 * Resolve a trained LoRA by ID from the bundled registry.
 * Returns ONLY active entries — retired LoRAs are excluded.
 */
export function resolveLora(id: string): TrainedLora | null {
  return resolveLoraFrom(loadRegistry(), id);
}

/**
 * Find all trained LoRAs for a given vendor (source image attribution).
 * Returns ALL entries (active AND retired) — audit queries see everything.
 * Match is on sourceImages[].vendorKey.
 */
export function findLorasForVendor(
  registry: TrainedLoraRegistry,
  vendorKey: string
): TrainedLora[] {
  return registry.loras.filter(lora =>
    lora.sourceImages.some(img => img.vendorKey === vendorKey)
  );
}
