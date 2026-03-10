import type { PageContent, DesignIssue } from './types';

export function analyseHeadingHierarchy(content: PageContent): { score: number; issues: DesignIssue[] } {
  const issues: DesignIssue[] = [];
  const headings = content.headings;
  let score = 15;

  // Check for H1
  const h1s = headings.filter(h => h.level === 1);
  if (h1s.length === 0) {
    issues.push({ type: 'error', category: 'heading', message: 'No H1 heading found on page', penalty: 10, element: 'h1' });
    score -= 10;
  } else if (h1s.length > 1) {
    issues.push({ type: 'warning', category: 'heading', message: `Multiple H1 headings found (${h1s.length})`, penalty: 5, element: 'h1' });
    score -= 5;
  }

  // Check for level skips (e.g., H1 → H3 without H2)
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1];
    const curr = headings[i];
    if (curr.level > prev.level + 1) {
      issues.push({
        type: 'warning',
        category: 'heading',
        message: `Heading level skip: H${prev.level} → H${curr.level} (missing H${prev.level + 1})`,
        penalty: 5,
        element: `h${curr.level}`,
      });
      score -= 5;
    }
  }

  // Check for more than 4 nesting levels
  const maxLevel = headings.reduce((max, h) => Math.max(max, h.level), 0);
  if (maxLevel > 4) {
    issues.push({ type: 'info', category: 'heading', message: `Deep heading nesting detected (H${maxLevel})`, penalty: 2, element: `h${maxLevel}` });
    score -= 2;
  }

  return { score: Math.max(0, score), issues };
}
