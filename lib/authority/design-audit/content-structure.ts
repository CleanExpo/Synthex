import type { PageContent, DesignIssue } from './types';

export interface ContentStructureResult {
  claimIsolation: number;
  tableListStructure: number;
  answerQueryAlignment: number;
  boldEntityDefinitions: number;
  issues: DesignIssue[];
}

export function analyseContentStructure(content: PageContent): ContentStructureResult {
  const issues: DesignIssue[] = [];

  // Claim Isolation (0-15): paragraph length analysis
  let claimIsolation = 15;
  const longParas = content.paragraphs.filter(p => {
    const wordCount = p.trim().split(/\s+/).length;
    return wordCount > 100;
  });
  if (longParas.length > 0) {
    const penalty = Math.min(15, longParas.length * 3);
    claimIsolation = Math.max(0, 15 - penalty);
    issues.push({
      type: 'warning',
      category: 'citation',
      message: `${longParas.length} paragraph(s) exceed 100 words — break into shorter claim blocks (25-40 words each)`,
      penalty,
    });
  }

  // Table/List Structure (0-15)
  const structureCount = content.tables + content.lists;
  let tableListStructure = 0;
  if (structureCount === 0) {
    issues.push({ type: 'info', category: 'structure', message: 'No tables or lists found — structured data improves AI citation pickup', penalty: 0 });
  } else if (structureCount <= 2) {
    tableListStructure = 8;
  } else {
    tableListStructure = 15;
  }

  // Answer-Query Alignment (0-15): detect FAQ patterns
  const faqPattern = /^(what|how|why|when|where|who|which|can|does|is|are|should|do)\s/im;
  const faqHeadings = content.headings.filter(h =>
    faqPattern.test(h.text) || h.text.includes('?')
  ).length;
  const answerQueryAlignment = Math.min(15, faqHeadings * 3);

  // Bold Entity Definitions (0-10): detect bold term + definition patterns
  const boldPatterns = [/<strong>[^<]{3,50}<\/strong>\s*[:\-—]/, /\*\*[^*]{3,50}\*\*\s*[:\-—]/];
  const hasBoldDefs = boldPatterns.some(p => p.test(content.html));
  const boldEntityDefinitions = hasBoldDefs ? 10 : 0;
  if (!hasBoldDefs) {
    issues.push({ type: 'info', category: 'citation', message: 'Add bold entity definitions (e.g., **Term**: definition) to improve AI citation pickup', penalty: 0 });
  }

  return { claimIsolation, tableListStructure, answerQueryAlignment, boldEntityDefinitions, issues };
}
