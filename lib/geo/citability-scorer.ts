/**
 * Citability Scorer
 *
 * Calculates content citability score (0-100) based on passage quality,
 * answer-first formatting, and citation density.
 *
 * @module lib/geo/citability-scorer
 */

import type { CitablePassage } from './types';

export function scoreCitability(passages: CitablePassage[], fullContent: string): number {
  if (passages.length === 0) return 0;

  // Average passage score (40% of citability)
  const avgPassageScore = passages.reduce((sum, p) => sum + p.score, 0) / passages.length;

  // Optimal length ratio (20% of citability)
  const optimalRatio = passages.filter(p => p.isOptimalLength).length / passages.length;
  const optimalScore = optimalRatio * 100;

  // Answer-first ratio (20% of citability)
  const answerFirstRatio = passages.filter(p => p.answerFirst).length / passages.length;
  const answerFirstScore = answerFirstRatio * 100;

  // Citation presence (20% of citability)
  const citationRatio = passages.filter(p => p.hasCitation).length / passages.length;
  const citationScore = citationRatio * 100;

  const overall = Math.round(
    avgPassageScore * 0.4 +
    optimalScore * 0.2 +
    answerFirstScore * 0.2 +
    citationScore * 0.2
  );

  return Math.min(100, Math.max(0, overall));
}
