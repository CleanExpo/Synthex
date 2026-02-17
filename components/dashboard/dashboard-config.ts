/**
 * Dashboard Configuration
 * Utilities for dashboard components
 */

/**
 * Format a timestamp to a human-readable relative time string
 */
export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

/**
 * AI Studio quick actions
 */
export const aiQuickActions = [
  { title: 'Generate Post', desc: 'Create engaging social posts' },
  { title: 'Hashtag Ideas', desc: 'Find trending hashtags' },
  { title: 'Content Calendar', desc: 'Plan your content strategy' },
];
