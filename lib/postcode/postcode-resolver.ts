/**
 * Postcode resolver — main entry point.
 *
 * Given a base location (lat, lng) and a search radius in km, return the list
 * of AU suburbs/postcodes that fall within that radius, sorted by distance
 * ascending.
 *
 * Foundation primitive for SYN-834: every contractor onboarding event
 * resolves through this function to determine which suburbs to open in DR's
 * service-area coverage.
 *
 * @see SYN-835 (parent: SYN-834 epic)
 */

import { haversineKm } from './haversine';
import { loadDataset } from './dataset-loader';
import type { BaseLocation, ResolveOptions, SuburbHit } from './types';

const MAX_RADIUS_KM = 200;

/**
 * Resolve all AU suburbs within `radiusKm` of `base`.
 *
 * @returns SuburbHit[] sorted by `distanceFromBaseKm` ascending.
 *          Empty array if no suburbs match (no error).
 *
 * @throws Error on invalid base coordinates (lat/lng out of range, NaN, etc.)
 *         or invalid radius (≤ 0 or > 200 km).
 *
 * Performance: O(N) scan across the dataset (~18.5k rows).
 * Measured < 30ms on Node 22 for typical 20km radius queries.
 */
export async function resolveSuburbsWithinRadius(
  base: BaseLocation,
  radiusKm: number,
  opts: ResolveOptions = {}
): Promise<SuburbHit[]> {
  validateBase(base);
  validateRadius(radiusKm);

  const dataset = opts.dataset ?? (await loadDataset());
  const stateFilter = opts.states ? new Set(opts.states) : null;

  const hits: SuburbHit[] = [];
  for (const row of dataset) {
    if (stateFilter && !stateFilter.has(row.state)) continue;
    const distance = haversineKm(base.lat, base.lng, row.lat, row.lng);
    if (distance <= radiusKm) {
      hits.push({
        postcode: row.postcode,
        suburb: row.suburb,
        state: row.state,
        lat: row.lat,
        lng: row.lng,
        distanceFromBaseKm: distance,
      });
    }
  }

  hits.sort((a, b) => a.distanceFromBaseKm - b.distanceFromBaseKm);
  return hits;
}

/**
 * Synchronous variant — for callers that have already pre-loaded the dataset
 * (e.g. via a startup hook). Caller MUST pass `opts.dataset` or this throws.
 */
export function resolveSuburbsWithinRadiusSync(
  base: BaseLocation,
  radiusKm: number,
  opts: ResolveOptions
): SuburbHit[] {
  if (!opts.dataset) {
    throw new Error(
      'resolveSuburbsWithinRadiusSync: opts.dataset is required (use resolveSuburbsWithinRadius for the async loader)'
    );
  }
  validateBase(base);
  validateRadius(radiusKm);

  const stateFilter = opts.states ? new Set(opts.states) : null;
  const hits: SuburbHit[] = [];
  for (const row of opts.dataset) {
    if (stateFilter && !stateFilter.has(row.state)) continue;
    const distance = haversineKm(base.lat, base.lng, row.lat, row.lng);
    if (distance <= radiusKm) {
      hits.push({
        postcode: row.postcode,
        suburb: row.suburb,
        state: row.state,
        lat: row.lat,
        lng: row.lng,
        distanceFromBaseKm: distance,
      });
    }
  }
  hits.sort((a, b) => a.distanceFromBaseKm - b.distanceFromBaseKm);
  return hits;
}

function validateBase(base: BaseLocation): void {
  if (!base || typeof base !== 'object') {
    throw new Error('resolveSuburbsWithinRadius: base location is required');
  }
  if (typeof base.lat !== 'number' || !Number.isFinite(base.lat)) {
    throw new Error(
      `resolveSuburbsWithinRadius: base.lat must be a finite number (got ${base.lat})`
    );
  }
  if (typeof base.lng !== 'number' || !Number.isFinite(base.lng)) {
    throw new Error(
      `resolveSuburbsWithinRadius: base.lng must be a finite number (got ${base.lng})`
    );
  }
  if (base.lat < -90 || base.lat > 90) {
    throw new Error(
      `resolveSuburbsWithinRadius: base.lat out of range [-90, 90] (got ${base.lat})`
    );
  }
  if (base.lng < -180 || base.lng > 180) {
    throw new Error(
      `resolveSuburbsWithinRadius: base.lng out of range [-180, 180] (got ${base.lng})`
    );
  }
}

function validateRadius(radiusKm: number): void {
  if (typeof radiusKm !== 'number' || !Number.isFinite(radiusKm)) {
    throw new Error(
      `resolveSuburbsWithinRadius: radiusKm must be a finite number (got ${radiusKm})`
    );
  }
  if (radiusKm <= 0) {
    throw new Error(
      `resolveSuburbsWithinRadius: radiusKm must be > 0 (got ${radiusKm})`
    );
  }
  if (radiusKm > MAX_RADIUS_KM) {
    throw new Error(
      `resolveSuburbsWithinRadius: radiusKm must be ≤ ${MAX_RADIUS_KM} (got ${radiusKm}). Sanity cap to prevent accidental global resolves.`
    );
  }
}
