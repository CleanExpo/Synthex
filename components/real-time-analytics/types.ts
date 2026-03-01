export interface AnalyticsData {
  overview: {
    totalReach: number;
    totalEngagement: number;
    totalFollowers: number;
    totalPosts: number;
    engagementRate: number;
    growthRate: number;
  };
  platforms: {
    [key: string]: {
      followers: number;
      engagement: number;
      posts: number;
      reach: number;
      growth: number;
    };
  };
  performance: {
    hourly: Array<{ hour: string; engagement: number; reach: number }>;
    daily: Array<{ day: string; engagement: number; reach: number; posts: number }>;
    weekly: Array<{ week: string; engagement: number; reach: number }>;
  };
  topContent: Array<{
    id: string;
    platform: string;
    content: string;
    engagement: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    timestamp: string;
  }>;
  demographics: {
    age: Array<{ range: string; percentage: number }>;
    gender: Array<{ type: string; percentage: number }>;
    location: Array<{ country: string; users: number }>;
  };
  trends: Array<{
    hashtag: string;
    mentions: number;
    growth: number;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
}
