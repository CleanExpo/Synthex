/**
 * Brand Builder — Google Knowledge Graph Search API Wrapper
 *
 * Checks Google Knowledge Graph for entity confidence score and KGMID.
 * Gracefully handles missing API key (returns { found: false }).
 *
 * @module lib/brand/kg-confidence-checker
 */

import type { KGCheckResult } from './types';

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface KGResultItem {
  result?: {
    '@id'?: string;
    name?: string;
    description?: string;
    '@type'?: string | string[];
    detailedDescription?: { articleBody?: string };
  };
  resultScore?: number;
}

interface KGApiResponse {
  itemListElement?: KGResultItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a string for fuzzy brand name matching
 */
function normaliseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Extract KGMID from @id field (format: "kg:/m/XXXXX" → "m/XXXXX")
 */
function extractKgmid(atId: string | undefined): string | null {
  if (!atId) return null;
  const match = atId.match(/^kg:(\/m\/[^/]+)/);
  return match ? match[1] : null;
}

/**
 * Normalise resultScore to 0-1 confidence.
 * Typical KG scores: 100-1000. We clamp to 0.0-1.0.
 */
function normaliseConfidence(resultScore: number | undefined): number {
  if (!resultScore || resultScore <= 0) return 0;
  return Math.min(1, resultScore / 1000);
}

/**
 * Extract @type array from result (can be string or string[])
 */
function extractTypes(type: string | string[] | undefined): string[] {
  if (!type) return [];
  if (Array.isArray(type)) return type;
  return [type];
}

// ---------------------------------------------------------------------------
// Main checker
// ---------------------------------------------------------------------------

/**
 * Check Google Knowledge Graph Search API for entity confidence.
 * Returns { found: false } if API key is not provided.
 */
export async function checkKnowledgeGraph(
  brandName: string,
  apiKey: string
): Promise<KGCheckResult> {
  const checkedAt = new Date().toISOString();

  if (!apiKey || apiKey.trim() === '') {
    return {
      found:       false,
      kgmid:       null,
      name:        null,
      description: null,
      confidence:  0,
      types:       [],
      checkedAt,
    };
  }

  try {
    const query = encodeURIComponent(brandName);
    const url   = `https://kgsearch.googleapis.com/v1/entities:search?query=${query}&key=${apiKey}&limit=3&indent=True`;

    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });

    if (!response.ok) {
      return notFoundResult(checkedAt);
    }

    const data: KGApiResponse = await response.json();
    const items = data.itemListElement ?? [];

    if (items.length === 0) {
      return notFoundResult(checkedAt);
    }

    // Find the best match: prefer an item whose name fuzzy-matches brandName
    const normBrand = normaliseName(brandName);
    const bestMatch = items.find(item => {
      const itemName = item.result?.name ?? '';
      return normaliseName(itemName) === normBrand;
    }) ?? items.reduce((best, current) => {
      return (current.resultScore ?? 0) > (best.resultScore ?? 0) ? current : best;
    }, items[0]);

    if (!bestMatch?.result) {
      return notFoundResult(checkedAt);
    }

    const { result, resultScore } = bestMatch;

    return {
      found:       true,
      kgmid:       extractKgmid(result['@id']),
      name:        result.name ?? null,
      description: result.description ?? result.detailedDescription?.articleBody?.slice(0, 200) ?? null,
      confidence:  normaliseConfidence(resultScore),
      types:       extractTypes(result['@type']),
      checkedAt,
    };
  } catch {
    return notFoundResult(checkedAt);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function notFoundResult(checkedAt: string): KGCheckResult {
  return {
    found:       false,
    kgmid:       null,
    name:        null,
    description: null,
    confidence:  0,
    types:       [],
    checkedAt,
  };
}
