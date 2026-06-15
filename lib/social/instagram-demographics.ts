/**
 * Instagram audience-demographics parser — lib/social/instagram-demographics.ts
 *
 * Pure functions that turn a raw Instagram Graph API `insights` response for
 * the `audience_gender_age` + `audience_country` metrics into the canonical
 * `AudienceData['demographics']` shape the audience surface consumes.
 *
 * Kept separate from `instagram-service.ts` so the parsing is unit-testable
 * against real Graph-API JSON without instantiating the whole service (mirrors
 * how `ingest-post-metrics.ts` keeps `normaliseMetrics` pure).
 *
 * HONEST DEGRADATION: if a metric is absent (account ineligible — personal /
 * creator / < 100 followers) the corresponding array is EMPTY. We never invent
 * percentages.
 *
 * @module lib/social/instagram-demographics
 */

import type { AudienceData } from './base-platform-service';

/**
 * Instagram `audience_gender_age` / `audience_country` values are returned as a
 * keyed object map under `values[0].value`, e.g.
 *   audience_gender_age → { "F.25-34": 1200, "M.25-34": 800, "U.45-54": 30 }
 *   audience_country     → { "US": 1500, "AU": 600, "GB": 300 }
 * (`F`/`M`/`U` = female/male/undisclosed; ISO-3166 alpha-2 country codes.)
 */
interface IGDemographicInsightValue {
  value?: Record<string, number>;
  end_time?: string;
}

interface IGDemographicInsightElement {
  name?: string;
  values?: IGDemographicInsightValue[];
}

export interface IGDemographicInsightsResponse {
  data?: IGDemographicInsightElement[];
}

/** Demographics entry the charts render (richer than the base type: + count). */
export interface AgeRangeEntry {
  range: string;
  percentage: number;
  count: number;
}
export interface GenderEntry {
  gender: string;
  percentage: number;
  count: number;
}
export interface LocationEntry {
  location: string;
  country: string;
  percentage: number;
  count: number;
}

/** Richer demographics shape (adds `count`/`country` over the base type). */
export interface ParsedDemographics {
  ageRanges: AgeRangeEntry[];
  genderSplit: GenderEntry[];
  topLocations: LocationEntry[];
}

/** Map the IG gender prefix to a human label. */
const GENDER_LABELS: Record<string, string> = {
  F: 'Female',
  M: 'Male',
  U: 'Other',
};

/**
 * Minimal ISO-3166 alpha-2 → country name map for the codes IG commonly
 * returns. Unknown codes fall back to the raw code so we never drop real data.
 */
const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  AU: 'Australia',
  GB: 'United Kingdom',
  CA: 'Canada',
  IN: 'India',
  NZ: 'New Zealand',
  IE: 'Ireland',
  DE: 'Germany',
  FR: 'France',
  BR: 'Brazil',
  MX: 'Mexico',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  JP: 'Japan',
  PH: 'Philippines',
  ID: 'Indonesia',
  ZA: 'South Africa',
  AE: 'United Arab Emirates',
  SG: 'Singapore',
};

/** Round to one decimal, guarding against NaN/Infinity. */
function pct(part: number, total: number): number {
  if (!total || !Number.isFinite(part)) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

/** Pull the keyed value map for a named metric out of the insights response. */
function metricValue(
  response: IGDemographicInsightsResponse | null | undefined,
  metric: string
): Record<string, number> | null {
  const el = response?.data?.find(d => d.name === metric);
  const raw = el?.values?.[0]?.value;
  if (!raw || typeof raw !== 'object') return null;
  // Defensive: keep only finite positive numbers.
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Parse `audience_gender_age` into separate age-range and gender breakdowns.
 * Buckets look like `F.25-34`. The age portion is summed across genders; the
 * gender portion is summed across ages. Percentages are of the total audience
 * the metric covers.
 */
function parseGenderAge(map: Record<string, number> | null): {
  ageRanges: AgeRangeEntry[];
  genderSplit: GenderEntry[];
} {
  if (!map) return { ageRanges: [], genderSplit: [] };

  const ageCounts: Record<string, number> = {};
  const genderCounts: Record<string, number> = {};
  let total = 0;

  for (const [bucket, count] of Object.entries(map)) {
    // `F.25-34` → ['F', '25-34']; some buckets may omit the dot.
    const dot = bucket.indexOf('.');
    const genderCode = dot >= 0 ? bucket.slice(0, dot) : 'U';
    const ageKey = dot >= 0 ? bucket.slice(dot + 1) : bucket;

    const genderLabel = GENDER_LABELS[genderCode] ?? 'Other';
    ageCounts[ageKey] = (ageCounts[ageKey] ?? 0) + count;
    genderCounts[genderLabel] = (genderCounts[genderLabel] ?? 0) + count;
    total += count;
  }

  const ageRanges: AgeRangeEntry[] = Object.entries(ageCounts)
    .map(([range, count]) => ({ range, count, percentage: pct(count, total) }))
    .sort((a, b) => a.range.localeCompare(b.range));

  // Stable gender order: Female, Male, Other (only those present).
  const genderOrder = ['Female', 'Male', 'Other'];
  const genderSplit: GenderEntry[] = genderOrder
    .filter(g => genderCounts[g] !== undefined)
    .map(g => ({
      gender: g,
      count: genderCounts[g],
      percentage: pct(genderCounts[g], total),
    }));

  return { ageRanges, genderSplit };
}

/**
 * Parse `audience_country` into the top locations (capped at 6), percentage of
 * the total audience the metric covers.
 */
function parseCountries(
  map: Record<string, number> | null,
  limit = 6
): LocationEntry[] {
  if (!map) return [];

  const total = Object.values(map).reduce((s, v) => s + v, 0);
  if (!total) return [];

  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([code, count]) => ({
      location: COUNTRY_NAMES[code] ?? code,
      country: code,
      count,
      percentage: pct(count, total),
    }));
}

/**
 * Turn a raw IG insights response (`audience_gender_age` + `audience_country`)
 * into the canonical demographics shape. Any missing metric → empty array.
 */
export function parseInstagramDemographics(
  response: IGDemographicInsightsResponse | null | undefined
): ParsedDemographics {
  const { ageRanges, genderSplit } = parseGenderAge(
    metricValue(response, 'audience_gender_age')
  );
  const topLocations = parseCountries(metricValue(response, 'audience_country'));
  return { ageRanges, genderSplit, topLocations };
}

/**
 * Does a parsed demographics object actually contain any audience signal?
 * Used by the surface to decide between rendering data and the honest
 * "not available" empty-state.
 */
export function hasDemographics(
  d: Pick<AudienceData['demographics'], 'ageRanges' | 'genderSplit'> & {
    topLocations: unknown[];
  }
): boolean {
  return (
    d.ageRanges.length > 0 ||
    d.genderSplit.length > 0 ||
    d.topLocations.length > 0
  );
}
