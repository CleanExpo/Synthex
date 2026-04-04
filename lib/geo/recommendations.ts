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

  // Entity coherence recommendations
  if (score.entityCoherence < 40) {
    recommendations.push({
      category: 'citability',
      priority: 'critical',
      title: 'Increase entity density for AI citation eligibility',
      description: 'Content has fewer than 15 named entities. AI engines cite pages with 15+ entities at 4.8x higher rates (Princeton KDD 2024). Add specific named people, organisations, locations, and concepts.',
      impact: 18,
    });
  }

  if (score.entityCoherence >= 40 && score.entityCoherence < 70) {
    recommendations.push({
      category: 'citability',
      priority: 'high',
      title: 'Improve entity naming consistency',
      description: 'Entities are referenced inconsistently (e.g., switching between "Google" and "the company"). Use consistent, full entity names throughout to reduce AI disambiguation uncertainty.',
      impact: 10,
    });
  }

  // --- Design-aware recommendations ---
  // These are based on content analysis already available and do NOT require the design audit addon.

  // 1. Long paragraphs: passages with more than 100 words that are not optimal length and don't answer-first
  const longParagraphCount = passages.filter(p => p.wordCount > 100 && !p.isOptimalLength).length;
  if (longParagraphCount > 0) {
    recommendations.push({
      category: 'design',
      priority: 'high',
      title: 'Break long paragraphs into claim-isolated blocks',
      description: `${longParagraphCount} passage${longParagraphCount > 1 ? 's exceed' : ' exceeds'} 100 words without optimal structure. Break them into claim-isolated blocks (25-40 words each) for better AI citation pickup.`,
      impact: 10,
    });
  }

  // 2. Insufficient tables/lists
  if (!structure.hasLists && !structure.hasTables) {
    // Only add if not already added by the structure block above (avoid duplicate)
    const alreadyAdded = recommendations.some(r => r.title === 'Add structured data elements');
    if (!alreadyAdded) {
      recommendations.push({
        category: 'design',
        priority: 'medium',
        title: 'Add structured data tables or numbered lists',
        description: 'Add structured data tables or numbered lists — AI search engines cite structured content 2.3x more than unstructured prose.',
        impact: 7,
      });
    }
  }

  // 3. Lacks FAQ patterns
  if (!structure.hasFAQ) {
    const alreadyAdded = recommendations.some(r => r.title === 'Add FAQ section');
    if (!alreadyAdded) {
      recommendations.push({
        category: 'design',
        priority: 'medium',
        title: 'Add Q&A sections with question headings',
        description: 'Add Q&A sections with question headings — aligns with how users prompt AI search and increases citation probability.',
        impact: 6,
      });
    }
  }

  // 4. Heading hierarchy issues
  if (!structure.headingHierarchy) {
    const alreadyAdded = recommendations.some(r => r.title === 'Fix heading hierarchy');
    if (!alreadyAdded) {
      recommendations.push({
        category: 'design',
        priority: 'high',
        title: 'Fix heading hierarchy (H1→H2→H3)',
        description: 'Fix heading hierarchy (H1→H2→H3) — skipped levels confuse both search engines and AI crawlers, reducing citation eligibility.',
        impact: 8,
      });
    }
  }

  // 5. Lacks inline citations
  if (citationDensity < 0.5) {
    const alreadyAdded = recommendations.some(r => r.category === 'authority' && r.title === 'Increase citation density');
    if (!alreadyAdded) {
      recommendations.push({
        category: 'design',
        priority: 'high',
        title: 'Add source attributions for AI citation eligibility',
        description: 'Add source attributions — content with inline citations gets 3.2x more AI citations. Aim for at least one attribution per 200 words.',
        impact: 12,
      });
    }
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
