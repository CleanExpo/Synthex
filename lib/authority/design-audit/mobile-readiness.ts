import type { PageContent, DesignIssue } from './types';

export function analyseMobileReadiness(content: PageContent): { score: number; issues: DesignIssue[] } {
  const issues: DesignIssue[] = [];
  let score = 15;

  // Viewport meta check
  if (!content.meta.viewport) {
    issues.push({ type: 'error', category: 'mobile', message: 'Missing viewport meta tag — required for mobile responsiveness', penalty: 7, element: 'meta[name=viewport]' });
    score -= 7;
  } else if (!content.meta.viewport.includes('width=device-width')) {
    issues.push({ type: 'warning', category: 'mobile', message: 'Viewport meta should include width=device-width', penalty: 3, element: 'meta[name=viewport]' });
    score -= 3;
  }

  // Check for tables without responsive wrapper (horizontal scroll risk)
  const tableCount = (content.html.match(/<table/gi) || []).length;
  const responsiveWrappers = (content.html.match(/overflow-[xy]|overflow:\s*(auto|scroll)|table-responsive/gi) || []).length;
  if (tableCount > 0 && responsiveWrappers === 0) {
    issues.push({ type: 'warning', category: 'mobile', message: `${tableCount} table(s) without responsive wrapper — risk of horizontal scroll on mobile`, penalty: 4, element: 'table' });
    score -= 4;
  }

  // Check images without explicit dimensions (CLS risk)
  const imagesWithoutDimensions = content.images.filter(img => !img.width && !img.height);
  if (imagesWithoutDimensions.length > 0) {
    const penalty = Math.min(4, imagesWithoutDimensions.length);
    issues.push({ type: 'warning', category: 'mobile', message: `${imagesWithoutDimensions.length} image(s) without explicit dimensions — may cause layout shift (CLS)`, penalty, element: 'img' });
    score -= penalty;
  }

  return { score: Math.max(0, score), issues };
}
