import { analyseHeadingHierarchy } from './heading-hierarchy';
import { analyseContentStructure } from './content-structure';
import type { PageContent, LLMCitationFitnessScore, DesignIssue } from './types';
import { analyzeEntities } from '@/lib/geo/entity-analyzer';

export function analyseLLMCitationFitness(content: PageContent): { score: LLMCitationFitnessScore; issues: DesignIssue[] } {
  const issues: DesignIssue[] = [];

  // Get C, T, A, B dimensions from content structure analyser
  const contentResult = analyseContentStructure(content);
  const { claimIsolation, tableListStructure, answerQueryAlignment, boldEntityDefinitions } = contentResult;
  issues.push(...contentResult.issues);

  // Logical Heading Depth (L): derive from heading hierarchy (0-15)
  const headingResult = analyseHeadingHierarchy(content);
  // heading score is already 0-15; use directly as logicalHeadingDepth
  const logicalHeadingDepth = headingResult.score;
  // Don't push heading issues here — they'll be included at orchestrator level

  // Inline Attribution (I): detect citation markers in content (0-15)
  const inlineAttributionPatterns = [
    /according to/gi,
    /source:/gi,
    /\([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*\d{4}\)/g, // (Author, Year)
    /\[\d+\]/g, // [1] footnote reference
    /\bfootnote\b/gi,
    /\bcited in\b/gi,
    /\bvia\b/gi,
  ];
  const combinedText = content.html + ' ' + content.text;
  const attributionMatches = inlineAttributionPatterns.filter(p => p.test(combinedText)).length;
  const inlineAttribution = Math.min(15, attributionMatches * 3);
  if (inlineAttribution === 0) {
    issues.push({
      type: 'info',
      category: 'citation',
      message: 'No inline attribution markers found — add "according to", "(Author, Year)" or [1] footnotes',
      penalty: 0,
    });
  }

  // Entity Consistency (E): use geo entity analyser, normalise 0-100 score to 0-15
  let entityConsistency = 10; // default heuristic fallback
  try {
    const entityResult = analyzeEntities(content.text);
    // entityResult.score is 0-100; scale to 0-15
    entityConsistency = Math.round((entityResult.score / 100) * 15);
    if (entityResult.coherenceIssues.length > 0) {
      issues.push({
        type: 'warning',
        category: 'citation',
        message: `${entityResult.coherenceIssues.length} entity coherence issue(s) detected — inconsistent naming reduces AI citation accuracy`,
        penalty: Math.min(5, entityResult.coherenceIssues.length),
      });
    }
  } catch {
    // If entity analysis fails, use default score
    entityConsistency = 10;
  }

  const score: LLMCitationFitnessScore = {
    claimIsolation,
    inlineAttribution,
    tableListStructure,
    answerQueryAlignment,
    boldEntityDefinitions,
    logicalHeadingDepth,
    entityConsistency,
    total: claimIsolation + inlineAttribution + tableListStructure + answerQueryAlignment + boldEntityDefinitions + logicalHeadingDepth + entityConsistency,
  };

  return { score, issues };
}
