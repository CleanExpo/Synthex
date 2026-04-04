/**
 * computeAuthorityScore — lib/scoring/computeAuthorityScore.ts
 *
 * Pure function: given structured client signals, returns a 0–100
 * E.E.A.T. composite Authority Score with a per-pillar breakdown.
 *
 * No database dependencies — safe to call from API routes, Edge
 * Functions, or Jest tests without mocking Prisma.
 *
 * Scoring rubric v1.1 — SYN-532 (updated from SYN-513):
 *   GBP completeness      20 pts  (was 25)
 *   Review velocity       15 pts  (was 20)
 *   Content freshness     15 pts  (was 20)
 *   Backlink signals      10 pts  (was 15 — placeholder)
 *   Schema coverage       10 pts  (unchanged)
 *   Review response rate  15 pts  (NEW — SYN-532)
 *   Average review score  15 pts  (NEW — replaces social proof 10pts)
 *   ──────────────────────────────
 *   Total                100 pts
 *
 * @task SYN-513, SYN-532
 */

// ── Input ─────────────────────────────────────────────────────────────────────

export interface AuthorityScoreInput {
  // GBP completeness signals (20 pts)
  gbpLocationCount: number; // ≥1 unlocks the pillar
  gbpHasPhone: boolean;
  gbpHasAddress: boolean;
  gbpHasHours: boolean;
  gbpHasCategories: boolean;
  gbpIsVerified: boolean;

  // Review velocity — recent reviews (15 pts)
  recentReviewCount: number; // reviews in last 30 days

  // Content freshness — published posts (15 pts)
  publishedPostsLast30Days: number;

  // Backlink signals (10 pts — placeholder, data not yet in DB)
  backlinkDomainCount?: number; // optional; defaults to 0

  // Schema / Brand DNA coverage (10 pts)
  hasBrandDna: boolean;
  brandDnaHasTone: boolean;
  brandDnaHasIndustry: boolean;

  // Review response rate — SYN-532 (15 pts)
  // Fraction 0.0–1.0: posted replies / total reviews in last 90 days
  reviewResponseRate?: number; // optional; defaults to 0

  // Average review score — SYN-532 (15 pts, replaces social proof)
  totalReviewCount: number;
  averageRating: number; // 0.0–5.0
}

// ── Output ────────────────────────────────────────────────────────────────────

export interface EEATBreakdown {
  gbpCompleteness: number; // 0–20
  reviewVelocity: number; // 0–15
  contentFreshness: number; // 0–15
  backlinkSignals: number; // 0–10
  schemaCoverage: number; // 0–10
  reviewResponseRate: number; // 0–15 (SYN-532)
  averageReviewScore: number; // 0–15 (SYN-532, replaces socialProof)
  /** @deprecated Use averageReviewScore. Kept for backwards-compat with stored JSON. */
  socialProof?: number;
}

export interface AuthorityScoreResult {
  score: number; // 0–100 (integer)
  breakdown: EEATBreakdown;
  signalsVersion: '1.1';
}

// ── Scoring helpers ───────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scoreGBPCompleteness(input: AuthorityScoreInput): number {
  if (input.gbpLocationCount === 0) return 0;
  let pts = 4; // base: has at least one location
  if (input.gbpHasAddress) pts += 5;
  if (input.gbpHasPhone) pts += 3;
  if (input.gbpHasHours) pts += 4;
  if (input.gbpHasCategories) pts += 2;
  if (input.gbpIsVerified) pts += 2;
  return clamp(pts, 0, 20);
}

function scoreReviewVelocity(recentCount: number): number {
  // 0 → 0, 1 → 6, 2 → 11, 3+ → 15
  if (recentCount === 0) return 0;
  if (recentCount === 1) return 6;
  if (recentCount === 2) return 11;
  return 15;
}

function scoreContentFreshness(postsLast30Days: number): number {
  // 0 → 0, 1 → 6, 2–3 → 10, 4–6 → 13, 7+ → 15
  if (postsLast30Days === 0) return 0;
  if (postsLast30Days === 1) return 6;
  if (postsLast30Days <= 3) return 10;
  if (postsLast30Days <= 6) return 13;
  return 15;
}

function scoreBacklinks(domainCount: number): number {
  // Placeholder rubric — will be replaced when backlink data is available
  // 0 → 0, 1–5 → 3, 6–20 → 6, 21–100 → 8, 100+ → 10
  if (domainCount === 0) return 0;
  if (domainCount <= 5) return 3;
  if (domainCount <= 20) return 6;
  if (domainCount <= 100) return 8;
  return 10;
}

function scoreSchemaCoverage(input: AuthorityScoreInput): number {
  if (!input.hasBrandDna) return 0;
  let pts = 4; // base: BrandDNA exists
  if (input.brandDnaHasTone) pts += 3;
  if (input.brandDnaHasIndustry) pts += 3;
  return clamp(pts, 0, 10);
}

/**
 * Review response rate (SYN-532):
 * % of reviews with a posted reply in last 90 days.
 * 0% → 0, 25%+ → 5, 50%+ → 10, 75%+ → 13, 90%+ → 15
 */
function scoreReviewResponseRate(rate: number): number {
  if (rate >= 0.9) return 15;
  if (rate >= 0.75) return 13;
  if (rate >= 0.5) return 10;
  if (rate >= 0.25) return 5;
  return 0;
}

/**
 * Average review score (SYN-532):
 * Proportional to star rating — 5.0 = 15pts, 4.0 = 12pts, 3.0 = 9pts,
 * 2.0 = 6pts, 1.0 = 3pts. Zero reviews → 0.
 */
function scoreAverageReviewScore(
  totalReviews: number,
  avgRating: number
): number {
  if (totalReviews === 0) return 0;
  if (avgRating >= 4.8) return 15;
  if (avgRating >= 4.0) return 12;
  if (avgRating >= 3.0) return 9;
  if (avgRating >= 2.0) return 6;
  return 3;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compute the Synthex Authority Score for a client.
 *
 * @param input  Structured signals fetched from the DB by the caller
 * @returns      score (0-100), per-pillar breakdown, and algorithm version
 */
export function computeAuthorityScore(
  input: AuthorityScoreInput
): AuthorityScoreResult {
  const gbpCompleteness = scoreGBPCompleteness(input);
  const reviewVelocity = scoreReviewVelocity(input.recentReviewCount);
  const contentFreshness = scoreContentFreshness(
    input.publishedPostsLast30Days
  );
  const backlinkSignals = scoreBacklinks(input.backlinkDomainCount ?? 0);
  const schemaCoverage = scoreSchemaCoverage(input);
  const reviewResponseRate = scoreReviewResponseRate(
    input.reviewResponseRate ?? 0
  );
  const averageReviewScore = scoreAverageReviewScore(
    input.totalReviewCount,
    input.averageRating
  );

  const breakdown: EEATBreakdown = {
    gbpCompleteness,
    reviewVelocity,
    contentFreshness,
    backlinkSignals,
    schemaCoverage,
    reviewResponseRate,
    averageReviewScore,
  };

  const total =
    gbpCompleteness +
    reviewVelocity +
    contentFreshness +
    backlinkSignals +
    schemaCoverage +
    reviewResponseRate +
    averageReviewScore;

  return {
    score: clamp(Math.round(total), 0, 100),
    breakdown,
    signalsVersion: '1.1',
  };
}
