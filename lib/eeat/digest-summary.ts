/**
 * E-E-A-T Digest Summary (SYN-510)
 *
 * Aggregates the existing E-E-A-T content scorer across an organisation's
 * recent content into a single concise summary for the Weekly Digest:
 * an average score plus the most common improvement opportunities.
 *
 * Pure function — no I/O. The cron route supplies the org-scoped content.
 *
 * @module lib/eeat/digest-summary
 */

import { scoreEEATContent } from './content-scorer';

export interface EEATDigestSummary {
  averageScore: number; // 0-100, rounded across scored content
  postCount: number; // number of non-empty pieces of content scored
  topOpportunities: string[]; // up to 3 most frequent missing signals
}

/**
 * Summarise E-E-A-T across a set of content strings.
 * Returns null when there is no non-empty content to score.
 */
export function summariseContentEEAT(
  contents: string[]
): EEATDigestSummary | null {
  const nonEmpty = contents.filter((c) => c && c.trim().length > 0);
  if (nonEmpty.length === 0) return null;

  let totalScore = 0;
  const missingCounts = new Map<string, number>();

  for (const content of nonEmpty) {
    const audit = scoreEEATContent(content);
    totalScore += audit.overallScore;
    for (const dimension of [
      audit.experience,
      audit.expertise,
      audit.authority,
      audit.trust,
    ]) {
      for (const miss of dimension.missing) {
        missingCounts.set(miss, (missingCounts.get(miss) ?? 0) + 1);
      }
    }
  }

  const topOpportunities = [...missingCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([description]) => description);

  return {
    averageScore: Math.round(totalScore / nonEmpty.length),
    postCount: nonEmpty.length,
    topOpportunities,
  };
}
