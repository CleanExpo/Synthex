/**
 * Helper functions for persona data transformation.
 * Extracted from app/dashboard/personas/page.tsx.
 */

import type { Persona } from './types';
import type { Persona as APIPersona } from '@/hooks/use-personas';

/**
 * Derive a stable numeric component id from a persona's API id.
 *
 * Persona API ids are Prisma `cuid()` strings (e.g. `clxy29a7b0000…`), which
 * `parseInt(_, 10)` cannot parse — it returns `NaN`. The previous
 * `parseInt(p.id, 10) || Date.now()` therefore produced a fresh `Date.now()`
 * timestamp on every transform, so the numeric id changed on every render and
 * could never be mapped back to its cuid. That broke selection, React keys, and
 * every action routed through {@link findApiId} (delete / train / clone all
 * failed with "Persona not found").
 *
 * This computes a deterministic, non-negative 32-bit hash of the cuid (FNV-1a)
 * so the numeric id is stable for a given persona and {@link findApiId} can
 * recover the original cuid by recomputing the same hash. Numeric-string ids
 * are still honoured directly for forward compatibility.
 */
export function personaComponentId(apiId: string): number {
  // Honour genuinely numeric ids (e.g. legacy/seed data) as-is.
  if (/^\d+$/.test(apiId)) {
    const n = parseInt(apiId, 10);
    if (Number.isSafeInteger(n)) return n;
  }

  // FNV-1a 32-bit hash → stable, deterministic, non-negative.
  let hash = 0x811c9dc5;
  for (let i = 0; i < apiId.length; i++) {
    hash ^= apiId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Transform an API persona to the component Persona type */
export function transformPersona(p: APIPersona): Persona {
  return {
    id: personaComponentId(p.id),
    name: p.name || '',
    description: p.description || '',
    trainingData: {
      sources: p.trainingSourcesCount || 0,
      words: p.trainingWordsCount || 0,
      samples: p.trainingSamplesCount || 0,
    },
    attributes: {
      tone: (p.tone || 'Professional').charAt(0).toUpperCase() + (p.tone || 'professional').slice(1),
      style: (p.style || 'Formal').charAt(0).toUpperCase() + (p.style || 'formal').slice(1),
      vocabulary: (p.vocabulary || 'Standard').charAt(0).toUpperCase() + (p.vocabulary || 'standard').slice(1),
      emotion: (p.emotion || 'Neutral').charAt(0).toUpperCase() + (p.emotion || 'neutral').slice(1),
    },
    accuracy: p.accuracy || 0,
    status: (p.status as Persona['status']) || 'draft',
    lastTrained: p.lastTrained ? new Date(p.lastTrained).toLocaleDateString() : 'Never',
  };
}

/**
 * Find an API persona id (cuid) from a numeric component id.
 *
 * Matches on the stable hash produced by {@link personaComponentId} so cuid
 * personas round-trip correctly. A direct string compare is also kept so a
 * numeric-string api id still resolves.
 */
export function findApiId(apiPersonas: APIPersona[], componentId: number): string | null {
  const found = apiPersonas.find(
    (p) => personaComponentId(p.id) === componentId || p.id === String(componentId)
  );
  return found?.id || null;
}
