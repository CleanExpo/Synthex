/**
 * Brand Builder — NAP + Handle Consistency Scorer
 *
 * Pure TypeScript scorer. Scores based on declared data only — does NOT
 * make HTTP requests to platform pages (live checking is expensive).
 *
 * @module lib/brand/consistency-scorer
 */

import type {
  BrandIdentityInput,
  ConsistencyReport,
  ConsistencyResult,
  NameMatchType,
} from './types';

// ---------------------------------------------------------------------------
// Name normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise a brand name for comparison:
 * - lowercase
 * - strip legal suffixes (Inc, LLC, Ltd, Corp, Co, etc.)
 * - strip punctuation and extra whitespace
 */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(incorporated|corporation|company|limited|inc|llc|ltd|corp|co)\b\.?/g, '')
    .replace(/[.,&'"-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Determine name match type between canonical and found name
 */
function getNameMatchType(canonical: string, found: string | null): NameMatchType {
  if (found === null) return 'not-found';
  if (canonical === found) return 'exact';
  if (normaliseName(canonical) === normaliseName(found)) return 'variant';
  return 'mismatch';
}

/**
 * Score a single platform based on match type
 */
function scoreForMatchType(match: NameMatchType): number {
  switch (match) {
    case 'exact':     return 100;
    case 'variant':   return 70;
    case 'mismatch':  return 20;
    case 'not-found': return 0;
  }
}

// ---------------------------------------------------------------------------
// Platform registry: url → { name, weight }
// sameAs platforms (LinkedIn, Wikidata, Wikipedia, Crunchbase) weight=3, others=1
// ---------------------------------------------------------------------------

interface PlatformMeta {
  name: string;
  weight: number;
  isSameAs: boolean;
}

function getPlatformMeta(url: string): PlatformMeta {
  const lower = url.toLowerCase();
  if (lower.includes('wikidata.org'))      return { name: 'Wikidata',     weight: 3, isSameAs: true };
  if (lower.includes('wikipedia.org'))     return { name: 'Wikipedia',    weight: 3, isSameAs: true };
  if (lower.includes('linkedin.com'))      return { name: 'LinkedIn',     weight: 3, isSameAs: true };
  if (lower.includes('crunchbase.com'))    return { name: 'Crunchbase',   weight: 3, isSameAs: true };
  if (lower.includes('youtube.com'))       return { name: 'YouTube',      weight: 1, isSameAs: false };
  if (lower.includes('twitter.com') || lower.includes('x.com'))
                                           return { name: 'Twitter/X',    weight: 1, isSameAs: false };
  if (lower.includes('facebook.com'))      return { name: 'Facebook',     weight: 1, isSameAs: false };
  if (lower.includes('instagram.com'))     return { name: 'Instagram',    weight: 1, isSameAs: false };
  return { name: new URL(url).hostname, weight: 1, isSameAs: false };
}

// ---------------------------------------------------------------------------
// Extract handle from URL for platform-specific checks
// ---------------------------------------------------------------------------

function extractHandleFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Score a single platform entry
// ---------------------------------------------------------------------------

function scorePlatform(
  platformUrl: string,
  canonicalName: string,
  declaredHandle: string | undefined
): ConsistencyResult {
  const meta    = getPlatformMeta(platformUrl);
  const handle  = declaredHandle ?? extractHandleFromUrl(platformUrl);
  const issues: string[] = [];

  // We score based on whether the declared handle/URL seems to match the canonical name.
  // Since we don't fetch the actual page, we compare URL slug to canonical name as proxy.
  const urlHandle = extractHandleFromUrl(platformUrl);
  let foundName: string | null = null;

  if (handle) {
    // Convert handle to a readable name for comparison (e.g. "synthex-ai" → "synthex ai")
    foundName = handle.replace(/[-_]/g, ' ');
  }

  const nameMatch = getNameMatchType(canonicalName, foundName);
  const score     = scoreForMatchType(nameMatch);

  if (nameMatch === 'mismatch') {
    issues.push(`Name mismatch on ${meta.name}: expected "${canonicalName}", found slug "${foundName}"`);
  } else if (nameMatch === 'not-found') {
    issues.push(`No handle found in ${meta.name} URL — verify the URL is correct`);
  }

  if (!urlHandle) {
    issues.push(`URL does not contain a discernible page handle: ${platformUrl}`);
  }

  return {
    platformUrl,
    platform: meta.name,
    canonicalName,
    foundName,
    nameMatch,
    issues,
    score,
    weight: meta.weight,
  };
}

// ---------------------------------------------------------------------------
// Build recommendations from results
// ---------------------------------------------------------------------------

function buildRecommendations(results: ConsistencyResult[]): string[] {
  const recs: string[] = [];

  const mismatched = results.filter(r => r.nameMatch === 'mismatch');
  const notFound   = results.filter(r => r.nameMatch === 'not-found');
  const variants   = results.filter(r => r.nameMatch === 'variant');

  if (mismatched.length > 0) {
    recs.push(
      `Update name on ${mismatched.map(r => r.platform).join(', ')} to exactly match canonical name "${mismatched[0].canonicalName}"`
    );
  }
  if (notFound.length > 0) {
    recs.push(
      `Verify the URLs for ${notFound.map(r => r.platform).join(', ')} — no handle could be detected`
    );
  }
  if (variants.length > 0) {
    recs.push(
      `Consider standardising name variants on ${variants.map(r => r.platform).join(', ')} for exact consistency`
    );
  }
  if (results.length === 0) {
    recs.push('Add sameAs platform URLs (LinkedIn, Wikidata, Wikipedia) to improve brand consistency scoring');
  }
  if (!results.some(r => r.platform === 'Wikidata')) {
    recs.push('Add a Wikidata URL — it is the highest-authority sameAs source for Knowledge Panel eligibility');
  }
  if (!results.some(r => r.platform === 'LinkedIn')) {
    recs.push('Add a LinkedIn URL — LinkedIn is a trusted sameAs source that reinforces E-E-A-T signals');
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Main scorer
// ---------------------------------------------------------------------------

/**
 * Score NAP + handle consistency for all declared sameAs platforms.
 * Returns a ConsistencyReport with per-platform scores and recommendations.
 */
export function scoreConsistency(identity: BrandIdentityInput): ConsistencyReport {
  const results: ConsistencyResult[] = [];
  const { canonicalName } = identity;

  // Score each declared platform URL
  const platforms: Array<{ url: string | undefined; handle?: string }> = [
    { url: identity.wikidataUrl },
    { url: identity.wikipediaUrl },
    { url: identity.linkedinUrl },
    { url: identity.crunchbaseUrl },
    { url: identity.youtubeUrl },
    { url: identity.twitterUrl },
    { url: identity.facebookUrl },
    { url: identity.instagramUrl },
  ];

  // Add any explicitly declared handles
  const handleMap = new Map<string, string>();
  (identity.declaredHandles ?? []).forEach(h => {
    if (h.url && h.handle) handleMap.set(h.url, h.handle);
  });

  for (const { url } of platforms) {
    if (!url) continue;
    const handle = handleMap.get(url);
    results.push(scorePlatform(url, canonicalName, handle));
  }

  // Calculate weighted overall score
  let totalWeight = 0;
  let weightedSum = 0;
  for (const r of results) {
    totalWeight += r.weight;
    weightedSum += r.score * r.weight;
  }

  const overallScore = totalWeight > 0
    ? Math.round(weightedSum / totalWeight)
    : 0;

  // Critical issues: sameAs platforms with mismatch
  const criticalIssues = results
    .filter(r => r.nameMatch === 'mismatch' && r.weight >= 3)
    .flatMap(r => r.issues);

  return {
    overallScore,
    results,
    criticalIssues,
    recommendations: buildRecommendations(results),
    auditedAt: new Date().toISOString(),
  };
}
