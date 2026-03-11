/**
 * PR Journalist CRM — Beat Classifier (Phase 92)
 *
 * Pure TypeScript keyword-based beat classification.
 * No AI call — deterministic, fast, no external dependency.
 *
 * @module lib/pr/beat-classifier
 */

// ---------------------------------------------------------------------------
// Beat keyword dictionary
// ---------------------------------------------------------------------------

const BEAT_KEYWORDS: Record<string, string[]> = {
  technology:    ['tech', 'software', 'startup', 'ai', 'artificial intelligence', 'machine learning', 'app', 'digital', 'cyber', 'saas', 'cloud', 'platform', 'developer', 'code', 'algorithm'],
  business:      ['merger', 'acquisition', 'ipo', 'revenue', 'profit', 'ceo', 'founder', 'entrepreneur', 'investment', 'valuation', 'board', 'executive', 'strategy', 'growth', 'market'],
  finance:       ['stock', 'shares', 'asx', 'nasdaq', 'interest rate', 'rba', 'bank', 'mortgage', 'inflation', 'dollar', 'economy', 'gdp', 'superannuation', 'fund', 'bonds'],
  startups:      ['startup', 'founder', 'seed', 'series a', 'series b', 'venture capital', 'vc', 'accelerator', 'incubator', 'pitch', 'pivot', 'bootstrapped', 'unicorn'],
  marketing:     ['marketing', 'brand', 'campaign', 'advertising', 'social media', 'content', 'seo', 'influencer', 'pr', 'public relations', 'communications', 'agency'],
  ecommerce:     ['ecommerce', 'retail', 'shopify', 'amazon', 'online store', 'marketplace', 'checkout', 'cart', 'fulfilment', 'logistics', 'shipping', 'inventory'],
  sustainability:['climate', 'sustainability', 'esg', 'carbon', 'green', 'renewable', 'solar', 'emissions', 'net zero', 'environment', 'recycling', 'circular economy'],
  health:        ['health', 'medical', 'pharma', 'biotech', 'hospital', 'mental health', 'wellness', 'clinical', 'fda', 'tga', 'therapy', 'diagnosis', 'treatment'],
  property:      ['property', 'real estate', 'housing', 'mortgage', 'auction', 'suburb', 'apartment', 'reit', 'developer', 'construction', 'rent', 'landlord'],
  education:     ['education', 'university', 'school', 'learning', 'student', 'teachers', 'curriculum', 'edtech', 'skills', 'training', 'certification', 'degree'],
  government:    ['government', 'policy', 'legislation', 'parliament', 'senate', 'minister', 'budget', 'election', 'regulation', 'compliance', 'federal', 'state'],
  sport:         ['sport', 'football', 'cricket', 'afl', 'nrl', 'tennis', 'swimming', 'olympics', 'athlete', 'team', 'coach', 'championship', 'tournament'],
  entertainment: ['entertainment', 'music', 'film', 'tv', 'streaming', 'netflix', 'celebrity', 'award', 'festival', 'concert', 'album', 'release', 'media'],
};

// ---------------------------------------------------------------------------
// Classification function
// ---------------------------------------------------------------------------

/**
 * Classify the beat of a journalist based on their outlet URL and recent headlines.
 *
 * @param outletUrl - The journalist's outlet domain (e.g. "techcrunch.com")
 * @param recentHeadlines - Array of recent article titles
 * @returns Promise resolving to the top beat string (e.g. "technology")
 */
export async function classifyBeat(
  outletUrl: string,
  recentHeadlines: string[]
): Promise<string> {
  const scores: Record<string, number> = {};

  // Normalise all text to lowercase for matching
  const allText = [outletUrl, ...recentHeadlines]
    .join(' ')
    .toLowerCase();

  // Score each beat based on keyword matches
  for (const [beat, keywords] of Object.entries(BEAT_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      // Count occurrences of each keyword
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = allText.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    scores[beat] = score;
  }

  // Find the beat with the highest score
  let topBeat = 'business'; // default fallback
  let topScore = 0;

  for (const [beat, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score;
      topBeat = beat;
    }
  }

  return topBeat;
}

/**
 * Classify multiple beats (top N) from headlines.
 * Useful for journalists who cover multiple topics.
 *
 * @param outletUrl - The journalist's outlet domain
 * @param recentHeadlines - Array of recent article titles
 * @param topN - Number of top beats to return (default: 3)
 * @returns Array of beat strings, ordered by relevance
 */
export function classifyTopBeats(
  outletUrl: string,
  recentHeadlines: string[],
  topN = 3
): string[] {
  const scores: Record<string, number> = {};

  const allText = [outletUrl, ...recentHeadlines]
    .join(' ')
    .toLowerCase();

  for (const [beat, keywords] of Object.entries(BEAT_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = allText.match(regex);
      if (matches) score += matches.length;
    }
    scores[beat] = score;
  }

  return Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([beat]) => beat);
}
