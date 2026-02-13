/**
 * GEO Recommendations Engine
 *
 * Generates prioritized improvement recommendations based on GEO scoring results.
 *
 * @module lib/geo/recommendations
 */

import type { GEOScore, GEORecommendation, CitablePassage, StructureAnalysis } from './types';

export function generateRecommendations(
  score: GEOScore,
  structure: StructureAnalysis,
  passages: CitablePassage[],
  citationDensity: number
): GEORecommendation[] {
  const recommendations: GEORecommendation[] = [];

  // Citability recommendations
  if (score.citability < 50) {
    recommendations.push({
      category: 'citability',
      priority: 'critical',
      title: 'Restructure content into citable passage blocks',
      description: 'Break content into self-contained 134-167 word passages. Each passage should start with a direct answer and include at least one inline citation.',
      impact: 20,
    });
  }

  const optimalCount = passages.filter(p => p.isOptimalLength).length;
  if (optimalCount === 0 && passages.length > 0) {
    recommendations.push({
      category: 'citability',
      priority: 'high',
      title: 'No passages in optimal citation range (134-167 words)',
      description: 'AI search engines preferentially cite passages in this word count range. Adjust paragraph lengths to hit this target.',
      impact: 15,
    });
  }

  const answerFirstCount = passages.filter(p => p.answerFirst).length;
  if (answerFirstCount < passages.length * 0.5) {
    recommendations.push({
      category: 'citability',
      priority: 'high',
      title: 'Apply answer-first formatting to more sections',
      description: 'Start each section with the key finding or answer, then provide supporting detail. This matches how AI engines extract citations.',
      impact: 12,
    });
  }

  // Structure recommendations
  if (!structure.hasH1) {
    recommendations.push({
      category: 'structure',
      priority: 'critical',
      title: 'Add H1 heading',
      description: 'Content must have exactly one H1 tag with the primary topic/keyword. This is the top-level signal for AI content understanding.',
      impact: 10,
    });
  }

  if (!structure.headingHierarchy) {
    recommendations.push({
      category: 'structure',
      priority: 'high',
      title: 'Fix heading hierarchy',
      description: 'Headings skip levels (e.g., H1 to H3). Use proper H1 > H2 > H3 nesting for semantic clarity.',
      impact: 8,
    });
  }

  if (!structure.hasLists && !structure.hasTables) {
    recommendations.push({
      category: 'structure',
      priority: 'medium',
      title: 'Add structured data elements',
      description: 'Include bulleted/numbered lists or data tables. These increase scanability and AI extraction probability.',
      impact: 7,
    });
  }

  if (!structure.hasFAQ) {
    recommendations.push({
      category: 'structure',
      priority: 'medium',
      title: 'Add FAQ section',
      description: 'FAQ sections with question-based headings align with conversational AI query patterns.',
      impact: 6,
    });
  }

  // Multi-modal recommendations
  if (score.multiModal < 40) {
    recommendations.push({
      category: 'multiModal',
      priority: 'high',
      title: 'Add visual content elements',
      description: 'Include original diagrams, data charts, or infographics. Use Paper Banana to generate publication-quality visuals.',
      impact: 15,
    });
  }

  // Authority recommendations
  if (citationDensity < 1) {
    recommendations.push({
      category: 'authority',
      priority: 'critical',
      title: 'Increase citation density',
      description: `Current density: ${citationDensity.toFixed(2)} per 200 words. Target: >= 1.0 per 200 words. Add inline citations from authoritative sources.`,
      impact: 15,
    });
  }

  if (score.authority < 50) {
    recommendations.push({
      category: 'authority',
      priority: 'high',
      title: 'Strengthen authority signals',
      description: 'Add author byline with credentials, methodology section, publication dates, and links to authoritative external sources.',
      impact: 12,
    });
  }

  // Technical recommendations
  if (!structure.hasSchema) {
    recommendations.push({
      category: 'technical',
      priority: 'critical',
      title: 'Add JSON-LD schema markup',
      description: 'Include Article schema with author, plus SpeakableSpecification for key passages. Required for AI search engine extraction.',
      impact: 15,
    });
  }

  // Sort by priority then impact
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return b.impact - a.impact;
  });

  return recommendations;
}
