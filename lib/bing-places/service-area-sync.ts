/**
 * Bing Places service-area sync — main API for SYN-841.
 *
 *   updateBingServiceArea(input, opts?) → result
 *
 * Mirrors the SYN-837 GBP workflow:
 *   1. Validate input (consent, source-of-truth job ID, localities list)
 *   2. Filter out localities > maxDistanceKm from contractor base
 *   3. Read current Bing service-area snapshot
 *   4. Diff new localities against current → additions only
 *   5. If additions empty → no-op (idempotent), still write audit row
 *   6. PUT Bing with union(current, additions)
 *   7. Write audit row
 *
 * @see SYN-841 (parent: SYN-834 epic)
 * @see lib/bing-places/README.md
 */

import { logger } from '@/lib/logger';
import {
  bingPlacesApiClient,
  noopBingPlacesAuditSink,
} from './bing-api-client';
import {
  MAX_DISTANCE_KM_DEFAULT,
  type BingLocality,
  type BingPlacesApiClient,
  type BingPlacesAuditSink,
  type BingPlacesUpdateOptions,
  type UpdateBingServiceAreaInput,
  type UpdateBingServiceAreaResult,
} from './types';

function resolveClient(
  opts: BingPlacesUpdateOptions = {}
): BingPlacesApiClient {
  return opts.client ?? bingPlacesApiClient;
}

function resolveAuditSink(
  opts: BingPlacesUpdateOptions = {}
): BingPlacesAuditSink {
  return opts.audit ?? noopBingPlacesAuditSink;
}

function resolveMaxDistanceKm(opts: BingPlacesUpdateOptions = {}): number {
  if (typeof opts.maxDistanceKm === 'number' && opts.maxDistanceKm > 0) {
    return opts.maxDistanceKm;
  }
  return MAX_DISTANCE_KM_DEFAULT;
}

/**
 * Sync DR's Bing Places service-area localities with newly-opened
 * suburbs. Idempotent — replaying the same event is a no-op.
 *
 * @throws Error on validation failure (consent, source-of-truth job ID,
 *   missing localities). NEVER syncs without consent.
 */
export async function updateBingServiceArea(
  input: UpdateBingServiceAreaInput,
  opts: BingPlacesUpdateOptions = {}
): Promise<UpdateBingServiceAreaResult> {
  validateInput(input);
  const client = resolveClient(opts);
  const audit = resolveAuditSink(opts);
  const maxDistanceKm = resolveMaxDistanceKm(opts);

  // 1) Distance sanity filter
  const { kept, dropped } = partitionByDistance(
    input.newLocalities,
    input.contractorBaseDistanceKmByLocality,
    maxDistanceKm
  );
  if (dropped.length > 0) {
    logger.warn('[bing-places.update] dropped far-from-base localities', {
      sourceOfTruthJobId: input.sourceOfTruthJobId,
      contractorId: input.contractorId,
      droppedLocalities: dropped.map(l => l.name),
      maxDistanceKm,
    });
  }

  if (kept.length === 0) {
    const reason =
      dropped.length > 0
        ? `all ${dropped.length} localities exceeded ${maxDistanceKm}km from base`
        : 'no localities to add';
    await safeAudit(audit, {
      sourceOfTruthJobId: input.sourceOfTruthJobId,
      contractorId: input.contractorId,
      storeId: input.storeId,
      localitiesAdded: [],
      localitiesSkipped: [],
      syncedAt: null,
      reason,
    });
    return {
      synced: false,
      added: [],
      skipped: [],
      droppedFarFromBase: dropped,
      reason,
    };
  }

  // 2) Read current Bing coverage
  const snapshot = await client.getServiceArea(input.storeId);
  const currentByName = new Map(
    snapshot.localities.map(l => [normaliseName(l.name), l])
  );

  // 3) Diff
  const added: BingLocality[] = [];
  const skipped: BingLocality[] = [];
  for (const l of kept) {
    if (currentByName.has(normaliseName(l.name))) {
      skipped.push(l);
    } else {
      added.push(l);
    }
  }

  // 4) Idempotent no-op when nothing new
  if (added.length === 0) {
    await safeAudit(audit, {
      sourceOfTruthJobId: input.sourceOfTruthJobId,
      contractorId: input.contractorId,
      storeId: input.storeId,
      localitiesAdded: [],
      localitiesSkipped: skipped,
      syncedAt: null,
      reason: 'all localities already in Bing coverage (idempotent re-play)',
    });
    return {
      synced: false,
      added: [],
      skipped,
      droppedFarFromBase: dropped,
      reason: 'all localities already in Bing coverage (idempotent re-play)',
    };
  }

  // 5) PUT union(current, added)
  const next = [...snapshot.localities, ...added];
  await client.putServiceArea(input.storeId, next);
  const syncedAt = new Date().toISOString();

  await safeAudit(audit, {
    sourceOfTruthJobId: input.sourceOfTruthJobId,
    contractorId: input.contractorId,
    storeId: input.storeId,
    localitiesAdded: added,
    localitiesSkipped: skipped,
    syncedAt,
  });

  logger.info('[bing-places.update] PUT applied', {
    sourceOfTruthJobId: input.sourceOfTruthJobId,
    contractorId: input.contractorId,
    storeId: input.storeId,
    addedCount: added.length,
    skippedCount: skipped.length,
    droppedCount: dropped.length,
  });

  return {
    synced: true,
    added,
    skipped,
    droppedFarFromBase: dropped,
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────

function validateInput(input: UpdateBingServiceAreaInput): void {
  if (!input || typeof input !== 'object') {
    throw new Error('updateBingServiceArea: input required');
  }
  if (!input.storeId) {
    throw new Error('updateBingServiceArea: storeId required');
  }
  if (!input.sourceOfTruthJobId) {
    throw new Error(
      'updateBingServiceArea: sourceOfTruthJobId required (Q3.2.4 H8)'
    );
  }
  if (!input.contractorId) {
    throw new Error('updateBingServiceArea: contractorId required');
  }
  if (input.consentGranted !== true) {
    throw new Error(
      'updateBingServiceArea: consentGranted must be true (NEVER sync Bing Places without consent)'
    );
  }
  if (!Array.isArray(input.newLocalities)) {
    throw new Error('updateBingServiceArea: newLocalities must be an array');
  }
  for (const l of input.newLocalities) {
    if (!l?.name) {
      throw new Error(
        'updateBingServiceArea: every locality must have a non-empty name'
      );
    }
  }
}

function partitionByDistance(
  localities: BingLocality[],
  distanceMap: Record<string, number> | undefined,
  maxKm: number
): { kept: BingLocality[]; dropped: BingLocality[] } {
  if (!distanceMap) {
    return { kept: [...localities], dropped: [] };
  }
  const kept: BingLocality[] = [];
  const dropped: BingLocality[] = [];
  for (const l of localities) {
    const distance = distanceMap[l.name];
    if (typeof distance === 'number' && distance > maxKm) {
      dropped.push(l);
    } else {
      kept.push(l);
    }
  }
  return { kept, dropped };
}

function normaliseName(s: string): string {
  return s.trim().toLowerCase();
}

async function safeAudit(
  sink: BingPlacesAuditSink,
  entry: Parameters<BingPlacesAuditSink>[0]
): Promise<void> {
  try {
    await sink(entry);
  } catch (err) {
    logger.error('[bing-places.update] audit sink failed (non-fatal)', {
      sourceOfTruthJobId: entry.sourceOfTruthJobId,
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}
