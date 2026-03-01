import {
  Twitter, Instagram, Linkedin, Youtube, Facebook
} from '@/components/icons';

export const platformIcons = {
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Facebook
};

export const platformColors = {
  twitter: '#1DA1F2',
  instagram: '#E4405F',
  linkedin: '#0077B5',
  youtube: '#FF0000',
  facebook: '#1877F2'
};

export const COLORS = ['#06b6d4', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'];

export function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function generateHourlyData() {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    engagement: Math.floor(Math.random() * 500) + 100,
    reach: Math.floor(Math.random() * 2000) + 500
  }));
}

export function generateDailyData() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map(day => ({
    day,
    engagement: Math.floor(Math.random() * 3000) + 1000,
    reach: Math.floor(Math.random() * 10000) + 5000,
    posts: Math.floor(Math.random() * 10) + 5
  }));
}

export function generateWeeklyData() {
  return Array.from({ length: 4 }, (_, i) => ({
    week: `Week ${i + 1}`,
    engagement: Math.floor(Math.random() * 10000) + 5000,
    reach: Math.floor(Math.random() * 50000) + 20000
  }));
}

export function generateTopContent() {
  const platforms = ['twitter', 'instagram', 'linkedin', 'youtube', 'facebook'];
  const contents = [
    "Just launched our new AI-powered content generator! Check it out and transform your social media game",
    "5 tips for growing your audience in 2024: Thread",
    "Behind the scenes of our latest product launch. The journey was incredible!",
    "How we increased engagement by 300% in just 30 days (case study)",
    "The future of social media marketing is here. Are you ready?",
    "Our team just hit 10K followers! Thank you for your amazing support",
    "Breaking: Major algorithm update coming next week. Here's what you need to know",
    "Free template pack for content creators! Link in bio"
  ];

  return contents.map((content, index) => ({
    id: `content-${index}`,
    platform: platforms[index % platforms.length],
    content,
    engagement: Math.floor(Math.random() * 5000) + 1000,
    reach: Math.floor(Math.random() * 20000) + 5000,
    likes: Math.floor(Math.random() * 2000) + 500,
    comments: Math.floor(Math.random() * 300) + 50,
    shares: Math.floor(Math.random() * 500) + 100,
    timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
  }));
}

export function getDefaultAnalyticsData() {
  return {
    overview: {
      totalReach: 245780,
      totalEngagement: 18945,
      totalFollowers: 12456,
      totalPosts: 147,
      engagementRate: 7.71,
      growthRate: 12.5
    },
    platforms: {
      twitter: { followers: 3456, engagement: 5234, posts: 45, reach: 67890, growth: 15.2 },
      instagram: { followers: 4567, engagement: 6789, posts: 38, reach: 89012, growth: 18.7 },
      linkedin: { followers: 2345, engagement: 3456, posts: 28, reach: 45678, growth: 8.9 },
      youtube: { followers: 1890, engagement: 2345, posts: 22, reach: 34567, growth: 22.3 },
      facebook: { followers: 198, engagement: 1121, posts: 14, reach: 8633, growth: 5.4 }
    },
    performance: {
      hourly: generateHourlyData(),
      daily: generateDailyData(),
      weekly: generateWeeklyData()
    },
    topContent: generateTopContent(),
    demographics: {
      age: [
        { range: '18-24', percentage: 25 },
        { range: '25-34', percentage: 35 },
        { range: '35-44', percentage: 22 },
        { range: '45-54', percentage: 12 },
        { range: '55+', percentage: 6 }
      ],
      gender: [
        { type: 'Male', percentage: 45 },
        { type: 'Female', percentage: 52 },
        { type: 'Other', percentage: 3 }
      ],
      location: [
        { country: 'United States', users: 4523 },
        { country: 'United Kingdom', users: 2341 },
        { country: 'Canada', users: 1876 },
        { country: 'Australia', users: 1234 },
        { country: 'Germany', users: 987 }
      ]
    },
    trends: [
      { hashtag: '#marketing', mentions: 1234, growth: 23.5, sentiment: 'positive' as const },
      { hashtag: '#ai', mentions: 987, growth: 45.2, sentiment: 'positive' as const },
      { hashtag: '#socialmedia', mentions: 765, growth: 12.8, sentiment: 'neutral' as const },
      { hashtag: '#content', mentions: 543, growth: -5.3, sentiment: 'neutral' as const },
      { hashtag: '#growth', mentions: 432, growth: 18.9, sentiment: 'positive' as const }
    ]
  };
}
