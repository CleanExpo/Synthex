/**
 * GEO Citation query generation — SYN-584 (dark run).
 *
 * Builds the three fixed query variants for a Google Business Profile location
 * from its primary category + suburb (locality). Google AI Overview only for
 * this ticket; the other engines in the schema CHECK constraint (chatgpt,
 * perplexity) are future sprints.
 *
 * V1: `{cat} {suburb}`        — bare intent
 * V2: `best {cat} {suburb}`   — superlative intent
 * V3: `{cat} near {suburb}`   — proximity intent
 */

export type QueryVariant = 1 | 2 | 3;

export interface GbpQuerySeed {
  /** GBP primary category display name, e.g. "Water Damage Restoration Service". */
  businessCategory: string;
  /** Locality / suburb, e.g. "Brisbane". */
  suburb: string;
}

export interface GeneratedQuery {
  variant: QueryVariant;
  text: string;
}

/**
 * Extract a query seed from a `gbp_locations` row's `categories` + `address`
 * JSON. Returns null when either the primary category or the locality is
 * missing — the caller MUST skip such locations (no fabricated queries).
 *
 * `categories.primaryCategory` may be a plain string or a Google
 * `{ displayName, ... }` object; `address.locality` is a string.
 */
export function extractQuerySeed(
  categories: unknown,
  address: unknown
): GbpQuerySeed | null {
  const businessCategory = readPrimaryCategory(categories);
  const suburb = readLocality(address);

  if (!businessCategory || !suburb) return null;
  return { businessCategory, suburb };
}

function readPrimaryCategory(categories: unknown): string | null {
  if (!categories || typeof categories !== 'object') return null;
  const primary = (categories as Record<string, unknown>).primaryCategory;
  if (typeof primary === 'string') return normalise(primary);
  if (primary && typeof primary === 'object') {
    const display = (primary as Record<string, unknown>).displayName;
    if (typeof display === 'string') return normalise(display);
  }
  return null;
}

function readLocality(address: unknown): string | null {
  if (!address || typeof address !== 'object') return null;
  const locality = (address as Record<string, unknown>).locality;
  return typeof locality === 'string' ? normalise(locality) : null;
}

function normalise(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Generate the three fixed AI-search query variants for a seed. */
export function generateQueries(seed: GbpQuerySeed): GeneratedQuery[] {
  const cat = seed.businessCategory.trim();
  const suburb = seed.suburb.trim();
  return [
    { variant: 1, text: `${cat} ${suburb}` },
    { variant: 2, text: `best ${cat} ${suburb}` },
    { variant: 3, text: `${cat} near ${suburb}` },
  ];
}
