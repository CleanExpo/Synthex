/**
 * GBP service-area updater — main API for SYN-837.
 *
 *   updateGbpServiceArea(input, opts?) → result
 *
 * Workflow per call:
 *   1. Validate input (consent, source-of-truth job ID, places list)
 *   2. Filter out places > maxDistanceKm from contractor base
 *   3. Read current GBP service-area snapshot
 *   4. Diff new places against current → additions only
 *   5. If additions empty → no-op (idempotent), still write audit row
 *   6. PATCH GBP with union(current, additions)
 *   7. Write audit row to foundation-keeper sink
 *
 * @see SYN-837 (parent: SYN-834 epic)
 * @see lib/gbp/README.md
 */

import { logger } from '@/lib/logger';
import { gbpApiClient, noopGbpAuditSink } from './gbp-api-client';
import {
  MAX_DISTANCE_KM_DEFAULT,
  type GbpApiClient,
  type GbpAuditSink,
  type GbpPlace,
  type GbpUpdateOptions,
  type UpdateGbpServiceAreaInput,
  type UpdateGbpServiceAreaResult,
} from './types';

function resolveClient(opts: GbpUpdateOptions = {}): GbpApiClient {
  return opts.client ?? gbpApiClient;
}

function resolveAuditSink(opts: GbpUpdateOptions = {}): GbpAuditSink {
  return opts.audit ?? noopGbpAuditSink;
}

function resolveMaxDistanceKm(opts: GbpUpdateOptions = {}): number {
  if (typeof opts.maxDistanceKm === 'number' && opts.maxDistanceKm > 0) {
    return opts.maxDistanceKm;
  }
  return MAX_DISTANCE_KM_DEFAULT;
}

/**
 * Update DR's GBP service-area attribute with newly-opened suburbs.
 * Idempotent — replaying the same event is a no-op.
 *
 * @throws Error on validation failure (consent, source-of-truth job ID,
 *   missing places). NEVER PATCHes without consent.
 */
export async function updateGbpServiceArea(
  input: UpdateGbpServiceAreaInput,
  opts: GbpUpdateOptions = {}
): Promise<UpdateGbpServiceAreaResult> {
  validateInput(input);
  const client = resolveClient(opts);
  const audit = resolveAuditSink(opts);
  const maxDistanceKm = resolveMaxDistanceKm(opts);

  // 1) Distance sanity filter
  const { kept, dropped } = partitionByDistance(
    input.newPlaces,
    input.contractorBaseDistanceKmByPlace,
    maxDistanceKm
  );
  if (dropped.length > 0) {
    logger.warn('[gbp.update] dropped far-from-base places', {
      sourceOfTruthJobId: input.sourceOfTruthJobId,
      contractorId: input.contractorId,
      droppedPlaces: dropped.map(p => p.placeName),
      maxDistanceKm,
    });
  }

  if (kept.length === 0) {
    const reason =
      dropped.length > 0
        ? `all ${dropped.length} places exceeded ${maxDistanceKm}km from base`
        : 'no places to add';
    await safeAudit(audit, {
      sourceOfTruthJobId: input.sourceOfTruthJobId,
      contractorId: input.contractorId,
      locationId: input.locationId,
      placesAdded: [],
      placesSkipped: [],
      patchedAt: null,
      reason,
    });
    return {
      patched: false,
      added: [],
      skipped: [],
      droppedFarFromBase: dropped,
      reason,
    };
  }

  // 2) Read current GBP coverage
  const snapshot = await client.getServiceArea(input.locationId);
  const currentByName = new Map(
    snapshot.places.map(p => [normalisePlaceName(p.placeName), p])
  );

  // 3) Diff
  const added: GbpPlace[] = [];
  const skipped: GbpPlace[] = [];
  for (const p of kept) {
    if (currentByName.has(normalisePlaceName(p.placeName))) {
      skipped.push(p);
    } else {
      added.push(p);
    }
  }

  // 4) Idempotent no-op when nothing new
  if (added.length === 0) {
    await safeAudit(audit, {
      sourceOfTruthJobId: input.sourceOfTruthJobId,
      contractorId: input.contractorId,
      locationId: input.locationId,
      placesAdded: [],
      placesSkipped: skipped,
      patchedAt: null,
      reason: 'all places already in GBP coverage (idempotent re-play)',
    });
    return {
      patched: false,
      added: [],
      skipped,
      droppedFarFromBase: dropped,
      reason: 'all places already in GBP coverage (idempotent re-play)',
    };
  }

  // 5) PATCH union(current, added)
  const next = [...snapshot.places, ...added];
  await client.patchServiceArea(input.locationId, next);
  const patchedAt = new Date().toISOString();

  await safeAudit(audit, {
    sourceOfTruthJobId: input.sourceOfTruthJobId,
    contractorId: input.contractorId,
    locationId: input.locationId,
    placesAdded: added,
    placesSkipped: skipped,
    patchedAt,
  });

  logger.info('[gbp.update] PATCH applied', {
    sourceOfTruthJobId: input.sourceOfTruthJobId,
    contractorId: input.contractorId,
    locationId: input.locationId,
    addedCount: added.length,
    skippedCount: skipped.length,
    droppedCount: dropped.length,
  });

  return {
    patched: true,
    added,
    skipped,
    droppedFarFromBase: dropped,
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────

function validateInput(input: UpdateGbpServiceAreaInput): void {
  if (!input || typeof input !== 'object') {
    throw new Error('updateGbpServiceArea: input required');
  }
  if (!input.locationId) {
    throw new Error('updateGbpServiceArea: locationId required');
  }
  if (!input.sourceOfTruthJobId) {
    throw new Error(
      'updateGbpServiceArea: sourceOfTruthJobId required (Q3.2.4 H8)'
    );
  }
  if (!input.contractorId) {
    throw new Error('updateGbpServiceArea: contractorId required');
  }
  if (input.consentGranted !== true) {
    throw new Error(
      'updateGbpServiceArea: consentGranted must be true (NEVER PATCH GBP without consent)'
    );
  }
  if (!Array.isArray(input.newPlaces)) {
    throw new Error('updateGbpServiceArea: newPlaces must be an array');
  }
  for (const p of input.newPlaces) {
    if (!p?.placeName) {
      throw new Error(
        'updateGbpServiceArea: every place must have a non-empty placeName'
      );
    }
  }
}

function partitionByDistance(
  places: GbpPlace[],
  distanceMap: Record<string, number> | undefined,
  maxKm: number
): { kept: GbpPlace[]; dropped: GbpPlace[] } {
  if (!distanceMap) {
    // No distance info supplied — caller takes responsibility; pass through.
    return { kept: [...places], dropped: [] };
  }
  const kept: GbpPlace[] = [];
  const dropped: GbpPlace[] = [];
  for (const p of places) {
    const distance = distanceMap[p.placeName];
    if (typeof distance === 'number' && distance > maxKm) {
      dropped.push(p);
    } else {
      kept.push(p);
    }
  }
  return { kept, dropped };
}

function normalisePlaceName(s: string): string {
  return s.trim().toLowerCase();
}

async function safeAudit(
  sink: GbpAuditSink,
  entry: Parameters<GbpAuditSink>[0]
): Promise<void> {
  try {
    await sink(entry);
  } catch (err) {
    logger.error('[gbp.update] audit sink failed (non-fatal)', {
      sourceOfTruthJobId: entry.sourceOfTruthJobId,
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}
