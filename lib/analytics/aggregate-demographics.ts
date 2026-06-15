/**
 * Demographics aggregation — lib/analytics/aggregate-demographics.ts
 *
 * Pure functions that aggregate the per-connection demographics stored in
 * `PlatformConnection.metadata.demographics` (written by
 * `sync-audience-demographics.ts`) into a single org-wide breakdown for the
 * audience insights route.
 *
 * Aggregation strategy: sum the raw `count` per bucket across connections (the
 * honest, audience-weighted way), then recompute percentages of the org total.
 * When counts are missing (older payloads), fall back to averaging the stored
 * percentages so we never invent precision we don't have.
 *
 * HONEST EMPTY: if no connection stored any demographic signal, the result is
 * empty arrays with `dataAvailable: false` — the surface shows the "not
 * available for your accounts yet" empty-state rather than fabricating data.
 *
 * @module lib/analytics/aggregate-demographics
 */

interface StoredAge {
  range: string;
  percentage: number;
  count?: number;
}
interface StoredGender {
  gender: string;
  percentage: number;
  count?: number;
}
interface StoredLocation {
  location: string;
  country?: string;
  percentage: number;
  count?: number;
}

/** The shape persisted under metadata.demographics. */
export interface ConnectionDemographicsMetadata {
  demographics?: {
    ageRanges?: StoredAge[];
    genderSplit?: StoredGender[];
    topLocations?: StoredLocation[];
    syncedAt?: string;
  };
}

export interface AggregatedAge {
  range: string;
  percentage: number;
  count: number;
}
export interface AggregatedGender {
  gender: string;
  percentage: number;
  count: number;
}
export interface AggregatedLocation {
  location: string;
  country: string;
  percentage: number;
  count: number;
}

export interface AggregatedDemographics {
  dataAvailable: boolean;
  ageRanges: AggregatedAge[];
  genderSplit: AggregatedGender[];
  topLocations: AggregatedLocation[];
  topLanguages: Array<{ language: string; percentage: number }>;
}

interface Bucket {
  count: number;
  pctSum: number;
  pctN: number;
  meta?: { country?: string };
}

function round1(n: number): number {
  return Number(n.toFixed(1));
}

/**
 * Reduce a set of stored entries (keyed by `key`) across connections into
 * normalised buckets, then emit percentages. Uses summed counts when present,
 * else averaged percentages.
 */
function reduceBuckets<T extends { percentage: number; count?: number }>(
  entries: Array<{ key: string; entry: T; country?: string }>,
  limit?: number
): Array<{ key: string; percentage: number; count: number; country?: string }> {
  const buckets = new Map<string, Bucket>();

  for (const { key, entry, country } of entries) {
    const b = buckets.get(key) ?? { count: 0, pctSum: 0, pctN: 0 };
    const c =
      typeof entry.count === 'number' && Number.isFinite(entry.count)
        ? Math.max(0, entry.count)
        : 0;
    b.count += c;
    if (typeof entry.percentage === 'number' && Number.isFinite(entry.percentage)) {
      b.pctSum += entry.percentage;
      b.pctN += 1;
    }
    if (country && !b.meta?.country) b.meta = { country };
    buckets.set(key, b);
  }

  const totalCount = [...buckets.values()].reduce((s, b) => s + b.count, 0);

  let rows = [...buckets.entries()].map(([key, b]) => {
    const percentage =
      totalCount > 0
        ? round1((b.count / totalCount) * 100)
        : b.pctN > 0
          ? round1(b.pctSum / b.pctN)
          : 0;
    return { key, percentage, count: b.count, country: b.meta?.country };
  });

  rows = rows.sort((a, b) => b.count - a.count || b.percentage - a.percentage);
  return limit ? rows.slice(0, limit) : rows;
}

/**
 * Aggregate per-connection stored demographics into one org-wide breakdown.
 * `metadatas` is the list of each connection's `metadata` Json (already typed
 * loosely — we only read `.demographics`).
 */
export function aggregateConnectionDemographics(
  metadatas: Array<ConnectionDemographicsMetadata | null | undefined>
): AggregatedDemographics {
  const ageEntries: Array<{ key: string; entry: StoredAge }> = [];
  const genderEntries: Array<{ key: string; entry: StoredGender }> = [];
  const locationEntries: Array<{
    key: string;
    entry: StoredLocation;
    country?: string;
  }> = [];

  for (const meta of metadatas) {
    const d = meta?.demographics;
    if (!d) continue;
    for (const a of d.ageRanges ?? []) {
      if (a?.range) ageEntries.push({ key: a.range, entry: a });
    }
    for (const g of d.genderSplit ?? []) {
      if (g?.gender) genderEntries.push({ key: g.gender, entry: g });
    }
    for (const l of d.topLocations ?? []) {
      if (l?.location)
        locationEntries.push({
          key: l.location,
          entry: l,
          country: l.country,
        });
    }
  }

  const ages = reduceBuckets(ageEntries).sort((a, b) =>
    a.key.localeCompare(b.key)
  );
  // Stable gender order Female, Male, Other.
  const genderOrder = ['Female', 'Male', 'Other'];
  const genders = reduceBuckets(genderEntries).sort(
    (a, b) => genderOrder.indexOf(a.key) - genderOrder.indexOf(b.key)
  );
  const locations = reduceBuckets(locationEntries, 6);

  const dataAvailable =
    ages.length > 0 || genders.length > 0 || locations.length > 0;

  return {
    dataAvailable,
    ageRanges: ages.map(r => ({
      range: r.key,
      percentage: r.percentage,
      count: r.count,
    })),
    genderSplit: genders.map(r => ({
      gender: r.key,
      percentage: r.percentage,
      count: r.count,
    })),
    topLocations: locations.map(r => ({
      location: r.key,
      country: r.country ?? '',
      percentage: r.percentage,
      count: r.count,
    })),
    // Languages are not exposed by the IG audience-insight metrics we fetch.
    topLanguages: [],
  };
}
