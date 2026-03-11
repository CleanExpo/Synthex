/**
 * Experiment Designer
 *
 * Generates SEO experiment suggestions based on current content metrics.
 * Rule-based analysis — no AI calls required.
 *
 * @module lib/experiments/experiment-designer
 */

import type {
  ExperimentSuggestion,
  CurrentMetrics,
  ExperimentType,
  MetricToTrack,
} from './types';

// ============================================================================
// Suggestion Rules
// ============================================================================

interface SuggestionRule {
  condition: (metrics: CurrentMetrics) => boolean;
  build: (metrics: CurrentMetrics) => ExperimentSuggestion;
}

const SUGGESTION_RULES: SuggestionRule[] = [
  // Rule 1: Low GEO score — add entity name to H1
  {
    condition: (m) => (m.geoScore ?? 100) < 70,
    build: (m) => ({
      experimentType: 'h1' as ExperimentType,
      title: 'Add entity name to H1 for GEO visibility',
      hypothesis:
        'Adding the primary entity name explicitly to the H1 heading will improve GEO score by making the page more citable by AI search engines.',
      originalValue: m.h1 ?? '(current H1)',
      variantValue: m.entityName
        ? `${m.h1 ?? 'H1'} — ${m.entityName}`
        : `${m.h1 ?? 'H1'} (add entity name here)`,
      metricToTrack: 'geo-score' as MetricToTrack,
      rationale: `Current GEO score is ${m.geoScore ?? 'unknown'}/100. Entity name prominence in headings is a key GEO citability signal.`,
      priority: 'high' as const,
    }),
  },

  // Rule 2: Short title — expand with primary keyword
  {
    condition: (m) => typeof m.title === 'string' && m.title.length < 50,
    build: (m) => ({
      experimentType: 'title-tag' as ExperimentType,
      title: 'Expand title tag with primary keyword',
      hypothesis:
        'A fuller title tag (50-60 characters) that includes the primary keyword and value proposition will improve click-through rate and search relevance signals.',
      originalValue: m.title ?? '(current title)',
      variantValue: `${m.title ?? ''} | ${m.entityName ?? 'Brand'} — [Add primary keyword]`,
      metricToTrack: 'position' as MetricToTrack,
      rationale: `Current title is ${m.title?.length ?? 0} characters. Optimal range is 50-60 characters for SERP display.`,
      priority: 'medium' as const,
    }),
  },

  // Rule 3: Short or missing meta description
  {
    condition: (m) =>
      !m.metaDescription || m.metaDescription.length < 100,
    build: (m) => ({
      experimentType: 'meta-description' as ExperimentType,
      title: 'Improve meta description for CTR',
      hypothesis:
        'A compelling meta description of 150-160 characters with a clear value proposition and call-to-action will improve click-through rate from search results.',
      originalValue: m.metaDescription ?? '(no meta description)',
      variantValue:
        '[Write 150-character description that leads with the primary benefit and ends with a CTA like "Learn more" or "Get started"]',
      metricToTrack: 'clicks' as MetricToTrack,
      rationale:
        !m.metaDescription
          ? 'No meta description found. Search engines will auto-generate one, which is typically suboptimal.'
          : `Meta description is only ${m.metaDescription.length} characters. Aim for 150-160 characters.`,
      priority: !m.metaDescription ? 'high' : 'medium',
    }),
  },

  // Rule 4: No schema markup
  {
    condition: (m) => m.hasSchema === false,
    build: (m) => ({
      experimentType: 'schema' as ExperimentType,
      title: 'Add Article/Organization schema markup',
      hypothesis:
        'Adding JSON-LD schema markup (Article + Organization) will improve rich result eligibility and AI search citability scores.',
      originalValue: 'No structured data',
      variantValue:
        '{"@type": "Article", "headline": "[title]", "author": {"@type": "Organization", "name": "[brand]"}, "datePublished": "[date]"}',
      metricToTrack: 'geo-score' as MetricToTrack,
      rationale:
        'Schema markup is a strong GEO and E-E-A-T signal. Pages without schema miss rich result opportunities.',
      priority: 'high' as const,
    }),
  },

  // Rule 5: Low E-E-A-T score — add author byline
  {
    condition: (m) => (m.eeaScore ?? 100) < 65,
    build: (m) => ({
      experimentType: 'content-structure' as ExperimentType,
      title: 'Add author byline and credentials section',
      hypothesis:
        'Adding a visible author byline with credentials and a brief bio will improve E-E-A-T signals and trust indicators.',
      originalValue: '(no visible author attribution)',
      variantValue:
        'Add "Written by [Author Name], [Title/Credential]. [2-3 sentence bio with relevant experience]." near article header.',
      metricToTrack: 'eeat-score' as MetricToTrack,
      rationale: `Current E-E-A-T score is ${m.eeaScore ?? 'unknown'}/100. Author attribution is a primary Experience and Expertise signal.`,
      priority: 'high' as const,
    }),
  },

  // Rule 6: Low quality score — add internal links
  {
    condition: (m) => (m.qualityScore ?? 100) < 60,
    build: (_m) => ({
      experimentType: 'internal-links' as ExperimentType,
      title: 'Add contextual internal links to improve content depth',
      hypothesis:
        'Adding 3-5 contextual internal links to related content will improve quality score, reduce bounce rate, and signal topical authority.',
      originalValue: '(current internal link count)',
      variantValue:
        'Add 3-5 descriptive internal links using anchor text that matches the linked page topic. Avoid generic "click here" text.',
      metricToTrack: 'quality-score' as MetricToTrack,
      rationale:
        'Low quality scores often correlate with thin content and poor internal linking. Contextual links signal depth.',
      priority: 'medium' as const,
    }),
  },
];

// ============================================================================
// Main Exported Function
// ============================================================================

/**
 * Generate experiment suggestions for a URL based on its current metrics.
 * Returns suggestions sorted by priority (high first).
 */
export function suggestExperiments(
  _url: string,
  currentMetrics: CurrentMetrics
): ExperimentSuggestion[] {
  const suggestions: ExperimentSuggestion[] = [];

  for (const rule of SUGGESTION_RULES) {
    if (rule.condition(currentMetrics)) {
      suggestions.push(rule.build(currentMetrics));
    }
  }

  // Sort: high > medium > low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return suggestions.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );
}

/**
 * Get a human-readable label for an experiment type.
 */
export function getExperimentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'title-tag': 'Title Tag',
    'meta-description': 'Meta Description',
    h1: 'H1 Heading',
    schema: 'Schema Markup',
    'content-structure': 'Content Structure',
    'internal-links': 'Internal Links',
  };
  return labels[type] ?? type;
}

/**
 * Get a human-readable label for a metric.
 */
export function getMetricLabel(metric: string): string {
  const labels: Record<string, string> = {
    'geo-score': 'GEO Score',
    'eeat-score': 'E-E-A-T Score',
    'quality-score': 'Quality Score',
    position: 'Search Position',
    clicks: 'Organic Clicks',
  };
  return labels[metric] ?? metric;
}
