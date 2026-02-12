/**
 * Dashboard Configuration
 * Utilities and mock data for dashboard components
 */

import type { TeamMember, ScheduledPost, AIGeneration } from './types';

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
 * Mock team members data
 */
export const mockTeamMembers: TeamMember[] = [
  { name: 'John Doe', role: 'Admin', status: 'online' },
  { name: 'Jane Smith', role: 'Editor', status: 'online' },
  { name: 'Mike Johnson', role: 'Viewer', status: 'offline' },
];

/**
 * Mock scheduled posts data
 */
export const mockScheduledPosts: ScheduledPost[] = [
  { platform: 'Twitter', content: 'Product launch announcement', time: 'Today, 2:00 PM', status: 'scheduled' },
  { platform: 'Instagram', content: 'Behind the scenes photo', time: 'Tomorrow, 10:00 AM', status: 'scheduled' },
  { platform: 'LinkedIn', content: 'Industry insights article', time: 'Feb 3, 9:00 AM', status: 'draft' },
];

/**
 * Mock AI generations data
 */
export const mockAIGenerations: AIGeneration[] = [
  { type: 'Post', content: '10 tips for growing your audience...', time: '2 min ago' },
  { type: 'Hashtags', content: '#SocialMedia #Growth #Marketing', time: '15 min ago' },
  { type: 'Caption', content: 'New product launch announcement...', time: '1 hour ago' },
];

/**
 * Platform breakdown percentages
 */
export const platformBreakdown = [
  { name: 'Twitter', percentage: 65 },
  { name: 'Instagram', percentage: 45 },
  { name: 'LinkedIn', percentage: 30 },
  { name: 'YouTube', percentage: 25 },
];

/**
 * AI Studio quick actions
 */
export const aiQuickActions = [
  { title: 'Generate Post', desc: 'Create engaging social posts' },
  { title: 'Hashtag Ideas', desc: 'Find trending hashtags' },
  { title: 'Content Calendar', desc: 'Plan your content strategy' },
];
