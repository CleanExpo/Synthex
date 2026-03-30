/**
 * computeAuthorityScore — lib/scoring/computeAuthorityScore.ts
 *
 * Pure function: given structured client signals, returns a 0–100
 * E.E.A.T. composite Authority Score with a per-pillar breakdown.
 *
 * No database dependencies — safe to call from API routes, Edge
 * Functions, or Jest tests without mocking Prisma.
 *
 * Scoring rubric v1.0 — SYN-513:
 *   GBP completeness   25 pts
 *   Review velocity    20 pts
 *   Content freshness  20 pts
 *   Backlink signals   15 pts (placeholder — no data yet)
 *   Schema coverage    10 pts
 *   Social proof       10 pts
 *   ─────────────────────────
 *   Total             100 pts
 *
 * @task SYN-513
 */

// ── Input ─────────────────────────────────────────────────────────────────────

export interface AuthorityScoreInput {
  // GBP completeness signals (25 pts)
  gbpLocationCount: number; // ≥1 unlocks the pillar
  gbpHasPhone: boolean;
  gbpHasAddress: boolean;
  gbpHasHours: boolean;
  gbpHasCategories: boolean;
  gbpIsVerified: boolean;

  // Review velocity — recent reviews (20 pts)
  recentReviewCount: number; // reviews in last 30 days

  // Content freshness — published posts (20 pts)
  publishedPostsLast30Days: number;

  // Backlink signals (15 pts — placeholder, data not yet in DB)
  backlinkDomainCount?: number; // optional; defaults to 0

  // Schema / Brand DNA coverage (10 pts)
  hasBrandDna: boolean;
  brandDnaHasTone: boolean;
  brandDnaHasIndustry: boolean;

  // Social proof — aggregate reviews (10 pts)
  totalReviewCount: number;
  averageRating: number; // 0.0–5.0
}

// ── Output ────────────────────────────────────────────────────────────────────

export interface EEATBreakdown {
  gbpCompleteness: number; // 0–25
  reviewVelocity: number; // 0–20
  contentFreshness: number; // 0–20
  backlinkSignals: number; // 0–15
  schemaCoverage: number; // 0–10
  socialProof: number; // 0–10
}

export interface AuthorityScoreResult {
  score: number; // 0–100 (integer)
  breakdown: EEATBreakdown;
  signalsVersion: '1.0';
}

// ── Scoring helpers ───────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scoreGBPCompleteness(input: AuthorityScoreInput): number {
  if (input.gbpLocationCount === 0) return 0;
  let pts = 5; // base: has at least one location
  if (input.gbpHasAddress) pts += 6;
  if (input.gbpHasPhone) pts += 4;
  if (input.gbpHasHours) pts += 5;
  if (input.gbpHasCategories) pts += 3;
  if (input.gbpIsVerified) pts += 2;
  return clamp(pts, 0, 25);
}

function scoreReviewVelocity(recentCount: number): number {
  // 0 → 0, 1 → 8, 2 → 14, 3+ → 20
  if (recentCount === 0) return 0;
  if (recentCount === 1) return 8;
  if (recentCount === 2) return 14;
  return 20;
}

function scoreContentFreshness(postsLast30Days: number): number {
  // 0 → 0, 1 → 8, 2–3 → 13, 4–6 → 17, 7+ → 20
  if (postsLast30Days === 0) return 0;
  if (postsLast30Days === 1) return 8;
  if (postsLast30Days <= 3) return 13;
  if (postsLast30Days <= 6) return 17;
  return 20;
}

function scoreBacklinks(domainCount: number): number {
  // Placeholder rubric — will be replaced when backlink data is available
  // 0 → 0, 1–5 → 4, 6–20 → 9, 21–100 → 13, 100+ → 15
  if (domainCount === 0) return 0;
  if (domainCount <= 5) return 4;
  if (domainCount <= 20) return 9;
  if (domainCount <= 100) return 13;
  return 15;
}

function scoreSchemaCoverage(input: AuthorityScoreInput): number {
  if (!input.hasBrandDna) return 0;
  let pts = 4; // base: BrandDNA exists
  if (input.brandDnaHasTone) pts += 3;
  if (input.brandDnaHasIndustry) pts += 3;
  return clamp(pts, 0, 10);
}

function scoreSocialProof(totalReviews: number, avgRating: number): number {
  if (totalReviews === 0) return 0;
  // Rating tiers
  if (avgRating >= 4.5) return 10;
  if (avgRating >= 4.0) return 7;
  if (avgRating >= 3.5) return 5;
  return 3; // has reviews but low rating
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
  const socialProof = scoreSocialProof(
    input.totalReviewCount,
    input.averageRating
  );

  const breakdown: EEATBreakdown = {
    gbpCompleteness,
    reviewVelocity,
    contentFreshness,
    backlinkSignals,
    schemaCoverage,
    socialProof,
  };

  const total =
    gbpCompleteness +
    reviewVelocity +
    contentFreshness +
    backlinkSignals +
    schemaCoverage +
    socialProof;

  return {
    score: clamp(Math.round(total), 0, 100),
    breakdown,
    signalsVersion: '1.0',
  };
}
