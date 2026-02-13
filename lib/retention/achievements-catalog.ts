/**
 * Achievements Catalog
 *
 * Static catalog of ~25 achievements across 5 categories.
 * Each achievement has conditions that are checked by the achievement tracker.
 *
 * Categories: content, engagement, consistency, exploration, social
 * Rarities: common, uncommon, rare, epic, legendary
 */

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'content' | 'engagement' | 'consistency' | 'exploration' | 'social';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  points: number;
  condition: {
    type: string;       // Event type or metric to check
    threshold: number;  // Target value
    metric?: string;    // Specific metric name if applicable
  };
}

export const ACHIEVEMENTS_CATALOG: AchievementDefinition[] = [
  // ==========================================
  // CONTENT (content creation milestones)
  // ==========================================
  {
    id: 'first_post',
    name: 'First Steps',
    description: 'Create your first piece of content',
    icon: '✍️',
    category: 'content',
    rarity: 'common',
    points: 10,
    condition: { type: 'content_created', threshold: 1 },
  },
  {
    id: 'content_10',
    name: 'Content Creator',
    description: 'Create 10 pieces of content',
    icon: '📝',
    category: 'content',
    rarity: 'common',
    points: 25,
    condition: { type: 'content_created', threshold: 10 },
  },
  {
    id: 'content_50',
    name: 'Prolific Publisher',
    description: 'Create 50 pieces of content',
    icon: '📚',
    category: 'content',
    rarity: 'uncommon',
    points: 50,
    condition: { type: 'content_created', threshold: 50 },
  },
  {
    id: 'content_100',
    name: 'Content Machine',
    description: 'Create 100 pieces of content',
    icon: '🏭',
    category: 'content',
    rarity: 'rare',
    points: 100,
    condition: { type: 'content_created', threshold: 100 },
  },
  {
    id: 'multi_platform',
    name: 'Cross-Pollinator',
    description: 'Publish content on 3+ different platforms',
    icon: '🌐',
    category: 'content',
    rarity: 'uncommon',
    points: 30,
    condition: { type: 'platforms_published', threshold: 3 },
  },

  // ==========================================
  // ENGAGEMENT (performance milestones)
  // ==========================================
  {
    id: 'first_viral',
    name: 'Going Viral',
    description: 'Get a post with 1,000+ engagements',
    icon: '🔥',
    category: 'engagement',
    rarity: 'rare',
    points: 75,
    condition: { type: 'max_post_engagement', threshold: 1000 },
  },
  {
    id: 'reach_10k',
    name: 'Growing Audience',
    description: 'Reach 10,000 total followers across all platforms',
    icon: '📈',
    category: 'engagement',
    rarity: 'uncommon',
    points: 50,
    condition: { type: 'total_followers', threshold: 10000 },
  },
  {
    id: 'reach_100k',
    name: 'Influencer',
    description: 'Reach 100,000 total followers',
    icon: '⭐',
    category: 'engagement',
    rarity: 'epic',
    points: 200,
    condition: { type: 'total_followers', threshold: 100000 },
  },
  {
    id: 'engagement_5pct',
    name: 'Engaging Content',
    description: 'Achieve 5%+ average engagement rate',
    icon: '💬',
    category: 'engagement',
    rarity: 'uncommon',
    points: 40,
    condition: { type: 'avg_engagement_rate', threshold: 5 },
  },
  {
    id: 'engagement_10pct',
    name: 'Engagement Master',
    description: 'Achieve 10%+ average engagement rate',
    icon: '🎯',
    category: 'engagement',
    rarity: 'rare',
    points: 100,
    condition: { type: 'avg_engagement_rate', threshold: 10 },
  },

  // ==========================================
  // CONSISTENCY (streak & activity milestones)
  // ==========================================
  {
    id: 'streak_3',
    name: 'Getting Started',
    description: 'Maintain a 3-day login streak',
    icon: '🔗',
    category: 'consistency',
    rarity: 'common',
    points: 15,
    condition: { type: 'current_streak', threshold: 3 },
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day login streak',
    icon: '🗓️',
    category: 'consistency',
    rarity: 'common',
    points: 25,
    condition: { type: 'current_streak', threshold: 7 },
  },
  {
    id: 'streak_30',
    name: 'Monthly Master',
    description: 'Maintain a 30-day login streak',
    icon: '💪',
    category: 'consistency',
    rarity: 'rare',
    points: 100,
    condition: { type: 'current_streak', threshold: 30 },
  },
  {
    id: 'streak_90',
    name: 'Quarter Champion',
    description: 'Maintain a 90-day login streak',
    icon: '🏆',
    category: 'consistency',
    rarity: 'epic',
    points: 250,
    condition: { type: 'current_streak', threshold: 90 },
  },
  {
    id: 'streak_365',
    name: 'Year of Dedication',
    description: 'Maintain a 365-day login streak',
    icon: '👑',
    category: 'consistency',
    rarity: 'legendary',
    points: 1000,
    condition: { type: 'current_streak', threshold: 365 },
  },

  // ==========================================
  // EXPLORATION (feature discovery)
  // ==========================================
  {
    id: 'first_persona',
    name: 'Identity Builder',
    description: 'Create your first brand persona',
    icon: '🎭',
    category: 'exploration',
    rarity: 'common',
    points: 20,
    condition: { type: 'personas_created', threshold: 1 },
  },
  {
    id: 'ab_tester',
    name: 'A/B Tester',
    description: 'Run your first A/B test',
    icon: '🧪',
    category: 'exploration',
    rarity: 'uncommon',
    points: 30,
    condition: { type: 'ab_tests_created', threshold: 1 },
  },
  {
    id: 'seo_analyst',
    name: 'SEO Analyst',
    description: 'Run your first SEO audit',
    icon: '🔍',
    category: 'exploration',
    rarity: 'uncommon',
    points: 30,
    condition: { type: 'seo_audits_run', threshold: 1 },
  },
  {
    id: 'competitor_tracker',
    name: 'Know Your Enemy',
    description: 'Track your first competitor',
    icon: '🕵️',
    category: 'exploration',
    rarity: 'uncommon',
    points: 25,
    condition: { type: 'competitors_tracked', threshold: 1 },
  },
  {
    id: 'scheduler',
    name: 'Time Manager',
    description: 'Schedule your first post',
    icon: '⏰',
    category: 'exploration',
    rarity: 'common',
    points: 15,
    condition: { type: 'posts_scheduled', threshold: 1 },
  },
  {
    id: 'feature_explorer',
    name: 'Feature Explorer',
    description: 'Use 10 different platform features',
    icon: '🗺️',
    category: 'exploration',
    rarity: 'rare',
    points: 75,
    condition: { type: 'unique_features_used', threshold: 10 },
  },
  {
    id: 'power_user',
    name: 'Power User',
    description: 'Use every major platform feature',
    icon: '⚡',
    category: 'exploration',
    rarity: 'legendary',
    points: 500,
    condition: { type: 'unique_features_used', threshold: 15 },
  },

  // ==========================================
  // SOCIAL (team & community)
  // ==========================================
  {
    id: 'team_builder',
    name: 'Team Builder',
    description: 'Invite your first team member',
    icon: '👥',
    category: 'social',
    rarity: 'common',
    points: 20,
    condition: { type: 'team_invites_sent', threshold: 1 },
  },
  {
    id: 'first_referral',
    name: 'Ambassador',
    description: 'Successfully refer your first user',
    icon: '🤝',
    category: 'social',
    rarity: 'uncommon',
    points: 50,
    condition: { type: 'successful_referrals', threshold: 1 },
  },
  {
    id: 'referral_5',
    name: 'Growth Champion',
    description: 'Successfully refer 5 users',
    icon: '🌟',
    category: 'social',
    rarity: 'rare',
    points: 150,
    condition: { type: 'successful_referrals', threshold: 5 },
  },
];

/**
 * Get achievement definition by ID
 */
export function getAchievementById(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS_CATALOG.find((a) => a.id === id);
}

/**
 * Get achievements by category
 */
export function getAchievementsByCategory(category: string): AchievementDefinition[] {
  return ACHIEVEMENTS_CATALOG.filter((a) => a.category === category);
}
