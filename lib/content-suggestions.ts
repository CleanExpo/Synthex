/**
 * Smart Content Suggestions Engine
 * AI-powered content recommendations based on trends, performance, and user behavior
 */

import { contentTemplates, type ContentTemplate } from './content-templates';

export interface ContentSuggestion {
  id: string;
  type: 'trending' | 'seasonal' | 'performance' | 'gap' | 'viral' | 'evergreen';
  title: string;
  description: string;
  confidence: number; // 0-100
  reasoning: string[];
  template?: ContentTemplate;
  timing: {
    bestTime: string;
    urgency: 'high' | 'medium' | 'low';
    deadline?: Date;
  };
  metrics: {
    expectedEngagement: number;
    expectedReach: number;
    viralPotential: number;
  };
  hashtags: string[];
  keywords: string[];
  competitors?: string[];
}

/** Performance data from past posts */
interface PerformanceData {
  postId: string;
  engagement: number;
  reach: number;
  platform: string;
  date: string;
}

interface UserContext {
  industry?: string;
  audience?: string[];
  timezone?: string;
  pastPerformance?: PerformanceData[];
  goals?: string[];
  brand?: string;
}

interface TrendData {
  topic: string;
  volume: number;
  growth: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  platforms: string[];
}

// Mock trending topics (in production, this would come from an API)
const trendingTopics: TrendData[] = [
  {
    topic: 'AI Innovation',
    volume: 125000,
    growth: 45,
    sentiment: 'positive',
    platforms: ['twitter', 'linkedin']
  },
  {
    topic: 'Sustainability',
    volume: 89000,
    growth: 23,
    sentiment: 'positive',
    platforms: ['instagram', 'linkedin']
  },
  {
    topic: 'Remote Work Tips',
    volume: 67000,
    growth: 15,
    sentiment: 'neutral',
    platforms: ['linkedin', 'twitter']
  },
  {
    topic: 'Mental Health Awareness',
    volume: 98000,
    growth: 30,
    sentiment: 'positive',
    platforms: ['instagram', 'facebook']
  },
  {
    topic: 'Crypto Updates',
    volume: 156000,
    growth: -10,
    sentiment: 'neutral',
    platforms: ['twitter']
  }
];

// Seasonal events and holidays
const seasonalEvents = [
  { name: 'New Year', date: '01-01', keywords: ['resolution', 'goals', 'fresh start'] },
  { name: 'Valentine\'s Day', date: '02-14', keywords: ['love', 'romance', 'gifts'] },
  { name: 'Earth Day', date: '04-22', keywords: ['sustainability', 'environment', 'green'] },
  { name: 'Black Friday', date: '11-24', keywords: ['deals', 'sales', 'shopping'] },
  { name: 'Cyber Monday', date: '11-27', keywords: ['online', 'deals', 'tech'] },
  { name: 'Christmas', date: '12-25', keywords: ['holiday', 'gifts', 'family'] }
];

// Best posting times by platform
const optimalTimes = {
  twitter: ['9:00 AM', '12:00 PM', '5:00 PM', '7:00 PM'],
  linkedin: ['7:30 AM', '12:00 PM', '5:30 PM'],
  instagram: ['11:00 AM', '2:00 PM', '5:00 PM', '8:00 PM'],
  facebook: ['9:00 AM', '3:00 PM', '7:00 PM'],
  tiktok: ['6:00 AM', '10:00 AM', '3:00 PM', '7:00 PM']
};

/**
 * Get smart content suggestions based on context
 */
export function getContentSuggestions(
  context: UserContext = {},
  limit: number = 5
): ContentSuggestion[] {
  const suggestions: ContentSuggestion[] = [];
  
  // 1. Trending Topic Suggestions
  const trendingSuggestions = generateTrendingSuggestions(context);
  suggestions.push(...trendingSuggestions);
  
  // 2. Seasonal Content Suggestions
  const seasonalSuggestions = generateSeasonalSuggestions(context);
  suggestions.push(...seasonalSuggestions);
  
  // 3. Performance-based Suggestions
  const performanceSuggestions = generatePerformanceSuggestions(context);
  suggestions.push(...performanceSuggestions);
  
  // 4. Content Gap Suggestions
  const gapSuggestions = identifyContentGaps(context);
  suggestions.push(...gapSuggestions);
  
  // 5. Viral Potential Suggestions
  const viralSuggestions = generateViralSuggestions(context);
  suggestions.push(...viralSuggestions);
  
  // Sort by confidence and return top suggestions
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

/**
 * Generate suggestions based on trending topics
 */
function generateTrendingSuggestions(context: UserContext): ContentSuggestion[] {
  return trendingTopics
    .filter(trend => trend.growth > 20)
    .map(trend => ({
      id: `trend-${trend.topic.toLowerCase().replace(/\s+/g, '-')}`,
      type: 'trending' as const,
      title: `Jump on the ${trend.topic} trend`,
      description: `Create content about ${trend.topic} while it's trending (+${trend.growth}% growth)`,
      confidence: Math.min(90, 50 + trend.growth),
      reasoning: [
        `${trend.volume.toLocaleString()} people are talking about this`,
        `${trend.growth}% growth in the last 24 hours`,
        `${trend.sentiment} sentiment overall`
      ],
      timing: {
        bestTime: optimalTimes[trend.platforms[0] as keyof typeof optimalTimes]?.[0] || '12:00 PM',
        urgency: trend.growth > 40 ? 'high' : 'medium'
      },
      metrics: {
        expectedEngagement: trend.volume * 0.05,
        expectedReach: trend.volume * 0.8,
        viralPotential: trend.growth
      },
      hashtags: [`#${trend.topic.replace(/\s+/g, '')}`, '#Trending', '#Viral'],
      keywords: trend.topic.toLowerCase().split(' '),
      competitors: []
    }));
}

/**
 * Generate seasonal content suggestions
 */
function generateSeasonalSuggestions(context: UserContext): ContentSuggestion[] {
  const today = new Date();
  const suggestions: ContentSuggestion[] = [];
  
  seasonalEvents.forEach(event => {
    const eventDate = new Date(today.getFullYear() + '-' + event.date);
    const daysUntil = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil > 0 && daysUntil <= 30) {
      suggestions.push({
        id: `seasonal-${event.name.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'seasonal',
        title: `Prepare ${event.name} content`,
        description: `${daysUntil} days until ${event.name} - perfect time to create relevant content`,
        confidence: 85 - daysUntil,
        reasoning: [
          `${event.name} is in ${daysUntil} days`,
          'Seasonal content performs 40% better',
          'Early preparation gives competitive advantage'
        ],
        timing: {
          bestTime: '10:00 AM',
          urgency: daysUntil < 7 ? 'high' : daysUntil < 14 ? 'medium' : 'low',
          deadline: eventDate
        },
        metrics: {
          expectedEngagement: 5000,
          expectedReach: 15000,
          viralPotential: 35
        },
        hashtags: [`#${event.name.replace(/\s+/g, '')}`, ...event.keywords.map(k => `#${k}`)],
        keywords: event.keywords,
        competitors: []
      });
    }
  });
  
  return suggestions;
}

/**
 * Generate suggestions based on past performance
 */
function generatePerformanceSuggestions(context: UserContext): ContentSuggestion[] {
  // Mock high-performing content types
  const suggestions: ContentSuggestion[] = [
    {
      id: 'perf-tips-list',
      type: 'performance',
      title: 'Create another tips list (your audience loves these!)',
      description: 'Your tips & tricks posts get 3x more engagement than average',
      confidence: 92,
      reasoning: [
        'Tips lists have 300% higher engagement',
        'Your audience saves and shares these',
        'Consistent high performance'
      ],
      template: contentTemplates.find(t => t.id === 'tips-list'),
      timing: {
        bestTime: '10:00 AM',
        urgency: 'medium'
      },
      metrics: {
        expectedEngagement: 8000,
        expectedReach: 25000,
        viralPotential: 45
      },
      hashtags: ['#Tips', '#HowTo', '#Learning'],
      keywords: ['tips', 'tricks', 'guide', 'how-to'],
      competitors: []
    },
    {
      id: 'perf-behind-scenes',
      type: 'performance',
      title: 'Share behind-the-scenes content',
      description: 'Your BTS content gets 2.5x more comments',
      confidence: 88,
      reasoning: [
        'Builds authentic connection',
        'Higher comment rate',
        'Increases brand trust'
      ],
      template: contentTemplates.find(t => t.id === 'behind-scenes'),
      timing: {
        bestTime: '2:00 PM',
        urgency: 'low'
      },
      metrics: {
        expectedEngagement: 6000,
        expectedReach: 18000,
        viralPotential: 30
      },
      hashtags: ['#BehindTheScenes', '#BTS', '#Authentic'],
      keywords: ['behind', 'scenes', 'process', 'team'],
      competitors: []
    }
  ];
  
  return suggestions;
}

/**
 * Identify content gaps in posting schedule
 */
function identifyContentGaps(context: UserContext): ContentSuggestion[] {
  // Mock gap analysis
  return [
    {
      id: 'gap-weekend',
      type: 'gap',
      title: 'Fill your weekend content gap',
      description: 'You haven\'t posted on weekends for 2 weeks',
      confidence: 78,
      reasoning: [
        'Weekend engagement is 25% higher',
        'Less competition for attention',
        'Your audience is active on weekends'
      ],
      timing: {
        bestTime: 'Saturday 11:00 AM',
        urgency: 'medium'
      },
      metrics: {
        expectedEngagement: 4500,
        expectedReach: 12000,
        viralPotential: 25
      },
      hashtags: ['#WeekendVibes', '#Saturday', '#Relax'],
      keywords: ['weekend', 'saturday', 'sunday', 'relax'],
      competitors: []
    }
  ];
}

/**
 * Generate viral potential suggestions
 */
function generateViralSuggestions(context: UserContext): ContentSuggestion[] {
  return [
    {
      id: 'viral-challenge',
      type: 'viral',
      title: 'Start a branded challenge',
      description: 'Challenges have 10x viral potential on TikTok and Instagram',
      confidence: 85,
      reasoning: [
        'Challenges drive user-generated content',
        'High shareability factor',
        'Builds community engagement'
      ],
      timing: {
        bestTime: '6:00 PM',
        urgency: 'medium'
      },
      metrics: {
        expectedEngagement: 15000,
        expectedReach: 50000,
        viralPotential: 80
      },
      hashtags: ['#Challenge', '#Viral', '#Trend'],
      keywords: ['challenge', 'viral', 'trend', 'participate'],
      competitors: []
    }
  ];
}

/**
 * Get personalized suggestions based on time of day
 */
export function getTimeBasedSuggestions(): ContentSuggestion {
  const hour = new Date().getHours();
  let suggestion: Partial<ContentSuggestion> = {};
  
  if (hour < 9) {
    suggestion = {
      title: 'Good morning post',
      description: 'Start the day with motivational content',
      hashtags: ['#GoodMorning', '#Motivation', '#DailyInspiration']
    };
  } else if (hour < 12) {
    suggestion = {
      title: 'Educational content',
      description: 'Share tips or tutorials while audience is focused',
      hashtags: ['#Learning', '#Tips', '#Tutorial']
    };
  } else if (hour < 14) {
    suggestion = {
      title: 'Lunch break entertainment',
      description: 'Light, engaging content for lunch scrollers',
      hashtags: ['#LunchBreak', '#Fun', '#Entertainment']
    };
  } else if (hour < 17) {
    suggestion = {
      title: 'Afternoon engagement',
      description: 'Ask questions or run polls',
      hashtags: ['#Question', '#Poll', '#Community']
    };
  } else if (hour < 20) {
    suggestion = {
      title: 'Evening stories',
      description: 'Share personal stories or behind-the-scenes',
      hashtags: ['#Evening', '#Stories', '#BehindTheScenes']
    };
  } else {
    suggestion = {
      title: 'Night owl content',
      description: 'Reflective or planning content for night audience',
      hashtags: ['#NightOwl', '#Reflection', '#Planning']
    };
  }
  
  return {
    id: `time-based-${hour}`,
    type: 'performance',
    confidence: 75,
    reasoning: [`Optimal for ${hour}:00 posting`],
    timing: {
      bestTime: `${hour}:00`,
      urgency: 'high'
    },
    metrics: {
      expectedEngagement: 3000,
      expectedReach: 10000,
      viralPotential: 20
    },
    keywords: [],
    ...suggestion
  } as ContentSuggestion;
}

/**
 * Get competitor-based suggestions
 */
export function getCompetitorSuggestions(competitors: string[]): ContentSuggestion[] {
  // Mock competitor analysis
  return competitors.map(competitor => ({
    id: `comp-${competitor}`,
    type: 'performance' as const,
    title: `Outperform ${competitor}'s recent viral post`,
    description: `${competitor} got 50K likes with similar content - you can do better!`,
    confidence: 70,
    reasoning: [
      'Proven content format',
      'Your audience overlaps with theirs',
      'Opportunity to improve on their approach'
    ],
    timing: {
      bestTime: '12:00 PM',
      urgency: 'medium' as const
    },
    metrics: {
      expectedEngagement: 5000,
      expectedReach: 20000,
      viralPotential: 40
    },
    hashtags: ['#Competition', '#Better', '#Winning'],
    keywords: ['better', 'improved', 'enhanced'],
    competitors: [competitor]
  }));
}

/**
 * Score content ideas based on multiple factors
 */
export function scoreContentIdea(
  idea: string,
  context: UserContext = {}
): number {
  let score = 50; // Base score
  
  // Check for trending keywords
  trendingTopics.forEach(trend => {
    if (idea.toLowerCase().includes(trend.topic.toLowerCase())) {
      score += trend.growth * 0.5;
    }
  });
  
  // Check for seasonal relevance
  const today = new Date();
  seasonalEvents.forEach(event => {
    const eventDate = new Date(today.getFullYear() + '-' + event.date);
    const daysUntil = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil > 0 && daysUntil <= 14) {
      event.keywords.forEach(keyword => {
        if (idea.toLowerCase().includes(keyword)) {
          score += (15 - daysUntil);
        }
      });
    }
  });
  
  // Check for high-performing content types
  const performanceKeywords = ['tips', 'how', 'guide', 'tutorial', 'behind', 'story'];
  performanceKeywords.forEach(keyword => {
    if (idea.toLowerCase().includes(keyword)) {
      score += 10;
    }
  });
  
  return Math.min(100, Math.max(0, score));
}