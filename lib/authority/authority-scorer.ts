/**
 * Authority Scorer — 4-factor scoring formula (0-100).
 *
 * Factors:
 *   1. Claim verification rate (40 pts)
 *   2. Source diversity          (20 pts)
 *   3. Source quality            (25 pts)
 *   4. Citation coverage         (15 pts)
 *
 * @module lib/authority/authority-scorer
 */

import type { ValidatedClaim, SourceType } from './types';

/**
 * Score overall authority from 0-100 based on validated claims and source distribution.
 */
export function scoreAuthority(
  claims: ValidatedClaim[],
  sourceBreakdown: Record<SourceType, number>
): number {
  if (claims.length === 0) return 0;

  const total = claims.length;

  // ── Factor 1: Claim verification rate (max 40 pts) ──────────────────────────
  const verified = claims.filter(c => c.verified).length;
  const verificationRate = verified / total;
  const verificationPoints = verificationRate * 40;

  // ── Factor 2: Source diversity (5 pts per unique source type, max 20) ───────
  const uniqueSourceTypes = (Object.keys(sourceBreakdown) as SourceType[]).filter(
    k => sourceBreakdown[k] > 0
  ).length;
  const diversityPoints = Math.min(20, uniqueSourceTypes * 5);

  // ── Factor 3: Source quality (capped at 25 pts) ──────────────────────────────
  // gov = 8 pts (max 16), academic = 5 pts (max 10), industry = 3 pts (max 6), web = 1 pt (max 3)
  const govCount     = sourceBreakdown['government'] ?? 0;
  const academicCount = sourceBreakdown['academic'] ?? 0;
  const industryCount = sourceBreakdown['industry'] ?? 0;
  const webCount      = sourceBreakdown['web'] ?? 0;

  const qualityRaw =
    Math.min(16, govCount * 8) +
    Math.min(10, academicCount * 5) +
    Math.min(6,  industryCount * 3) +
    Math.min(3,  webCount * 1);

  const qualityPoints = Math.min(25, qualityRaw);

  // ── Factor 4: Citation coverage (max 15 pts) ─────────────────────────────────
  const claimsWithCitations = claims.filter(
    c => c.verified && c.sources.length > 0
  ).length;
  const citationCoverage = claimsWithCitations / total;
  const citationPoints = citationCoverage * 15;

  const total_score = verificationPoints + diversityPoints + qualityPoints + citationPoints;
  return Math.round(Math.min(100, total_score));
}

export interface AuthorityTierResult {
  label: string;
  color: string;
}

/**
 * Map a numeric authority score to a tier label and colour.
 */
export function getAuthorityTier(score: number): AuthorityTierResult {
  if (score >= 80) return { label: 'Excellent', color: 'emerald' };
  if (score >= 60) return { label: 'Good',      color: 'cyan'    };
  if (score >= 40) return { label: 'Fair',       color: 'amber'   };
  return                   { label: 'Needs Work', color: 'red'    };
}
