/**
 * Brand Builder — Wikidata REST API Integration
 *
 * Entity Q-ID lookup and property completeness audit.
 * Completely free — no API key required.
 *
 * @module lib/brand/wikidata-checker
 */

import type { WikidataCheckResult } from './types';

// ---------------------------------------------------------------------------
// Constants: Property IDs
// ---------------------------------------------------------------------------

const REQUIRED_PROPS = ['P31', 'P856', 'P571']; // instance-of, official website, inception date
const RECOMMENDED_PROPS = ['P159', 'P112', 'P18', 'P2671']; // HQ, founder, image, KGMID

const PROP_LABELS: Record<string, string> = {
  P31:   'instance-of (what kind of entity)',
  P856:  'official website URL',
  P571:  'inception/founding date',
  P159:  'headquarters location',
  P112:  'founder',
  P18:   'image/logo',
  P2671: 'Google Knowledge Graph ID (KGMID)',
};

// ---------------------------------------------------------------------------
// Wikidata API types
// ---------------------------------------------------------------------------

interface WikidataSearchResult {
  id?: string;
  label?: string;
  description?: string;
  url?: string;
}

interface WikidataSearchResponse {
  search?: WikidataSearchResult[];
}

interface WikidataClaim {
  references?: unknown[];
}

interface WikidataEntity {
  labels?: { en?: { value?: string } };
  claims?: Record<string, WikidataClaim[]>;
}

interface WikidataEntitiesResponse {
  entities?: Record<string, WikidataEntity>;
}

// ---------------------------------------------------------------------------
// Score computation
// ---------------------------------------------------------------------------

function computeScore(
  found: boolean,
  presentProps: string[],
  referenceCount: number
): number {
  if (!found) return 0;

  let score = 50; // Base: entity found

  // +10 per required prop present
  for (const prop of REQUIRED_PROPS) {
    if (presentProps.includes(prop)) score += 10;
  }

  // +5 per recommended prop present
  for (const prop of RECOMMENDED_PROPS) {
    if (presentProps.includes(prop)) score += 5;
  }

  // Up to +10 for reference count (>3 references → full 10pts)
  if (referenceCount >= 3) score += 10;
  else if (referenceCount >= 1) score += Math.round((referenceCount / 3) * 10);

  return Math.min(100, score);
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

function buildRecommendations(
  found: boolean,
  missingRequired: string[],
  missingRecommended: string[],
  referenceCount: number
): string[] {
  const recs: string[] = [];

  if (!found) {
    recs.push('Create a Wikidata entry for your organisation to establish Knowledge Panel eligibility');
    recs.push('Add at minimum: instance-of (P31), official website (P856), inception date (P571)');
    return recs;
  }

  if (missingRequired.length > 0) {
    recs.push(
      `Add these required Wikidata properties: ${missingRequired.map(p => PROP_LABELS[p] ?? p).join('; ')}`
    );
  }
  if (missingRecommended.length > 0) {
    recs.push(
      `Add these recommended properties to improve completeness: ${missingRecommended.map(p => PROP_LABELS[p] ?? p).join('; ')}`
    );
  }
  if (referenceCount < 3) {
    recs.push(`Add more external references to your Wikidata entry (currently ${referenceCount}, aim for 3+)`);
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Main checker
// ---------------------------------------------------------------------------

/**
 * Check Wikidata for an entity by brand name (and optionally branded URL).
 * Searches for the entity, retrieves key properties, and returns a completeness score.
 */
export async function checkWikidata(
  brandName: string,
  brandUrl?: string
): Promise<WikidataCheckResult> {
  try {
    // Step 1: Search for entity
    const searchQuery  = encodeURIComponent(brandName);
    const searchUrl    = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${searchQuery}&language=en&limit=3&format=json&origin=*`;
    const searchResp   = await fetch(searchUrl, { signal: AbortSignal.timeout(10_000) });

    if (!searchResp.ok) {
      return notFoundResult();
    }

    const searchData: WikidataSearchResponse = await searchResp.json();
    if (!searchData.search || searchData.search.length === 0) {
      return notFoundResult();
    }

    // Step 2: Pick best matching entity
    const bestMatch = searchData.search.find(
      r => r.label?.toLowerCase() === brandName.toLowerCase()
    ) ?? searchData.search[0];

    if (!bestMatch?.id) {
      return notFoundResult();
    }

    const qId        = bestMatch.id;
    const entityLabel = bestMatch.label ?? brandName;
    const wikidataEntityUrl = `https://www.wikidata.org/wiki/${qId}`;

    // Step 3: Fetch entity claims
    const entityUrl  = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qId}&props=labels|claims&format=json&origin=*`;
    const entityResp = await fetch(entityUrl, { signal: AbortSignal.timeout(10_000) });

    if (!entityResp.ok) {
      return partialResult(qId, entityLabel, wikidataEntityUrl);
    }

    const entityData: WikidataEntitiesResponse = await entityResp.json();
    const entity = entityData.entities?.[qId];

    if (!entity) {
      return partialResult(qId, entityLabel, wikidataEntityUrl);
    }

    // Step 4: Check which properties are present
    const claims    = entity.claims ?? {};
    const allProps  = new Set([...REQUIRED_PROPS, ...RECOMMENDED_PROPS]);
    const presentProps: string[]          = [];
    const missingRequired: string[]       = [];
    const missingRecommended: string[]    = [];

    for (const prop of allProps) {
      if (claims[prop] && claims[prop].length > 0) {
        presentProps.push(prop);
      } else if (REQUIRED_PROPS.includes(prop)) {
        missingRequired.push(prop);
      } else {
        missingRecommended.push(prop);
      }
    }

    // Step 5: Count references across all claims
    let referenceCount = 0;
    for (const claimList of Object.values(claims)) {
      for (const claim of claimList) {
        if (Array.isArray(claim.references)) {
          referenceCount += claim.references.length;
        }
      }
    }

    const score = computeScore(true, presentProps, referenceCount);

    return {
      found: true,
      qId,
      entityLabel,
      wikidataUrl: wikidataEntityUrl,
      presentProps,
      missingRequiredProps: missingRequired,
      missingRecommendedProps: missingRecommended,
      referenceCount,
      score,
      recommendations: buildRecommendations(true, missingRequired, missingRecommended, referenceCount),
    };
  } catch {
    return notFoundResult();
  }
}

// ---------------------------------------------------------------------------
// Helper return shapes
// ---------------------------------------------------------------------------

function notFoundResult(): WikidataCheckResult {
  return {
    found: false,
    qId: null,
    entityLabel: null,
    wikidataUrl: null,
    presentProps: [],
    missingRequiredProps: REQUIRED_PROPS,
    missingRecommendedProps: RECOMMENDED_PROPS,
    referenceCount: 0,
    score: 0,
    recommendations: buildRecommendations(false, REQUIRED_PROPS, RECOMMENDED_PROPS, 0),
  };
}

function partialResult(qId: string, label: string, url: string): WikidataCheckResult {
  return {
    found: true,
    qId,
    entityLabel: label,
    wikidataUrl: url,
    presentProps: [],
    missingRequiredProps: REQUIRED_PROPS,
    missingRecommendedProps: RECOMMENDED_PROPS,
    referenceCount: 0,
    score: 50, // Found but couldn't fetch claims
    recommendations: buildRecommendations(true, REQUIRED_PROPS, RECOMMENDED_PROPS, 0),
  };
}
