/**
 * Gap Analyzer (Phase 96)
 *
 * Analyses tested prompts to identify visibility gaps — categories where
 * the entity is not being mentioned by AI responses.
 *
 * Pure computation — no DB calls, no external API calls.
 *
 * @module lib/prompts/gap-analyzer
 */

import type {
  PromptCategory,
  PromptGapAnalysis,
  CategoryMentionRate,
  CategoryGap,
  CompetitorVisibility,
} from './types';
import { CATEGORY_CONFIG } from './types';

// ─── Type imports (compatible with Prisma generated types) ────────────────────

interface TrackerRecord {
  id: string
  promptText: string
  promptCategory: string
  brandMentioned: boolean | null
  brandPosition: number | null
  entityName: string
}

interface ResultRecord {
  trackerId: string
  brandMentioned: boolean
  brandPosition: number | null
  competitorsFound: unknown  // Prisma Json type
}

// ─── Gap Analyser ─────────────────────────────────────────────────────────────

/**
 * Analyse gaps from a set of tracked prompts + their test results.
 *
 * @param trackers  - PromptTracker records (should all belong to same entity)
 * @param results   - PromptResult records (can be multiple per tracker — we use latest)
 */
export function analyzeGaps(
  trackers: TrackerRecord[],
  results: ResultRecord[]
): PromptGapAnalysis {
  // Use entity name from first tracker (they should all share the same entity)
  const entityName = trackers[0]?.entityName ?? 'Unknown';

  // Only analyse trackers that have been tested
  const tested = trackers.filter((t) => t.brandMentioned !== null);
  const testedCount = tested.length;
  const mentionedCount = tested.filter((t) => t.brandMentioned === true).length;
  const missedCount = testedCount - mentionedCount;
  const coverageRate = testedCount > 0 ? (mentionedCount / testedCount) * 100 : 0;

  // ── Per-category breakdown ──
  const categories = Object.keys(CATEGORY_CONFIG) as PromptCategory[];
  const categoryRates: CategoryMentionRate[] = categories.map((cat) => {
    const catTrackers = tested.filter((t) => t.promptCategory === cat);
    const catMentioned = catTrackers.filter((t) => t.brandMentioned === true).length;
    return {
      category: cat,
      testedCount: catTrackers.length,
      mentionedCount: catMentioned,
      mentionRate: catTrackers.length > 0 ? (catMentioned / catTrackers.length) * 100 : 0,
    };
  });

  // Sort: most-mentioned first
  const topCategories = [...categoryRates].sort((a, b) => b.mentionRate - a.mentionRate);

  // ── Gaps: categories with < 50% mention rate ──
  const gaps: CategoryGap[] = categoryRates
    .filter((cr) => cr.testedCount > 0 && cr.mentionRate < 50)
    .sort((a, b) => a.mentionRate - b.mentionRate)
    .map((cr) => {
      const missedTrackers = tested.filter(
        (t) => t.promptCategory === cr.category && t.brandMentioned === false
      );
      return {
        category: cr.category,
        missedPrompts: missedTrackers.map((t) => t.promptText),
        recommendation: buildRecommendation(cr.category, cr.mentionRate),
      };
    });

  return {
    entityName,
    testedCount,
    mentionedCount,
    missedCount,
    coverageRate: Math.round(coverageRate * 10) / 10,
    topCategories,
    gaps,
  };
}

// ─── Competitor Visibility Aggregator ────────────────────────────────────────

/**
 * Aggregate competitor mentions across all PromptResults.
 */
export function aggregateCompetitors(
  results: ResultRecord[],
  totalTested: number
): CompetitorVisibility[] {
  const countMap = new Map<string, { count: number; positions: number[] }>();

  for (const result of results) {
    const competitors = parseCompetitors(result.competitorsFound);
    for (const comp of competitors) {
      const normalised = comp.toLowerCase().trim();
      if (!countMap.has(normalised)) {
        countMap.set(normalised, { count: 0, positions: [] });
      }
      const entry = countMap.get(normalised)!;
      entry.count += 1;
      if (result.brandPosition != null) {
        entry.positions.push(result.brandPosition);
      }
    }
  }

  const visibility: CompetitorVisibility[] = [];
  for (const [competitor, data] of countMap.entries()) {
    if (data.count < 2) continue;  // Filter one-off noise
    const avgPosition = data.positions.length > 0
      ? data.positions.reduce((a, b) => a + b, 0) / data.positions.length
      : 0;
    visibility.push({
      competitor,
      mentionCount: data.count,
      mentionRate: totalTested > 0 ? (data.count / totalTested) * 100 : 0,
      avgPosition: Math.round(avgPosition * 10) / 10,
    });
  }

  return visibility.sort((a, b) => b.mentionCount - a.mentionCount);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseCompetitors(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string');
  }
  try {
    const parsed = JSON.parse(String(raw));
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

function buildRecommendation(category: PromptCategory, mentionRate: number): string {
  const rate = Math.round(mentionRate);
  switch (category) {
    case 'brand-awareness':
      return `Your brand appears in only ${rate}% of brand awareness queries. Create dedicated "About" and "Company" pages with clear entity signals to improve Knowledge Panel eligibility.`;
    case 'competitor-comparison':
      return `You're missing ${100 - rate}% of comparison queries. Publish comparison landing pages (e.g. "Synthex vs [Competitor]") with structured data to improve AI citation in comparison contexts.`;
    case 'local-discovery':
      return `Local discovery visibility is ${rate}%. Strengthen local SEO with consistent NAP citations, local schema markup, and Google Business Profile optimisation.`;
    case 'use-case':
      return `You appear in ${rate}% of use-case queries. Create problem-solution content targeting specific industry pain points and "best tool for X" queries.`;
    case 'how-to':
      return `How-to visibility is ${rate}%. Publish step-by-step guides, tutorials, and process documentation to establish topical authority in your domain.`;
    case 'product-feature':
      return `Product feature queries show ${rate}% visibility. Add dedicated feature pages with rich descriptions and FAQ schema to help AI models surface your capabilities.`;
    default:
      return `Visibility in this category is ${rate}%. Consider creating targeted content to improve AI citation rates.`;
  }
}
