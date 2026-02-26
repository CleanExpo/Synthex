'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Users, Eye, Heart, MessageSquare, Share2,
  Clock, Calendar, Globe, Target, Zap, Activity, ArrowUp, ArrowDown,
  Twitter, Instagram, Linkedin, Youtube, Facebook, RefreshCw, Download
} from '@/components/icons';
import { toast } from 'sonner';

interface AnalyticsData {
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

const platformIcons = {
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Facebook
};

const platformColors = {
  twitter: '#1DA1F2',
  instagram: '#E4405F',
  linkedin: '#0077B5',
  youtube: '#FF0000',
  facebook: '#1877F2'
};

const COLORS = ['#06b6d4', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'];

export default function RealTimeAnalytics() {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isRealTime, setIsRealTime] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
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
      { hashtag: '#marketing', mentions: 1234, growth: 23.5, sentiment: 'positive' },
      { hashtag: '#ai', mentions: 987, growth: 45.2, sentiment: 'positive' },
      { hashtag: '#socialmedia', mentions: 765, growth: 12.8, sentiment: 'neutral' },
      { hashtag: '#content', mentions: 543, growth: -5.3, sentiment: 'neutral' },
      { hashtag: '#growth', mentions: 432, growth: 18.9, sentiment: 'positive' }
    ]
  });

  // Simulate real-time updates
  useEffect(() => {
    if (!isRealTime) return;

    const interval = setInterval(() => {
      setAnalyticsData(prev => ({
        ...prev,
        overview: {
          ...prev.overview,
          totalReach: prev.overview.totalReach + Math.floor(Math.random() * 100),
          totalEngagement: prev.overview.totalEngagement + Math.floor(Math.random() * 10),
          engagementRate: +(Math.random() * 2 + 6).toFixed(2)
        }
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [isRealTime]);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update with fresh data
      setAnalyticsData(prev => ({
        ...prev,
        overview: {
          ...prev.overview,
          totalReach: prev.overview.totalReach + Math.floor(Math.random() * 1000),
          totalEngagement: prev.overview.totalEngagement + Math.floor(Math.random() * 100)
        }
      }));
      
      toast.success('Analytics data refreshed');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      setIsLoading(false);
    }
  };

  const exportData = () => {
    const dataStr = JSON.stringify(analyticsData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Analytics data exported');
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getChangeIcon = (value: number) => {
    return value >= 0 ? (
      <ArrowUp className="w-4 h-4 text-green-500" />
    ) : (
      <ArrowDown className="w-4 h-4 text-red-500" />
    );
  };

  const getChangeColor = (value: number) => {
    return value >= 0 ? 'text-green-500' : 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold gradient-text">Real-Time Analytics</h2>
          <p className="text-gray-400 mt-2">Monitor your social media performance in real-time</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="twitter">Twitter</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={isRealTime ? 'default' : 'outline'}
            onClick={() => setIsRealTime(!isRealTime)}
            className={isRealTime ? 'gradient-primary' : ''}
          >
            <Activity className="w-4 h-4 mr-2" />
            {isRealTime ? 'Live' : 'Paused'}
          </Button>
          <Button variant="outline" onClick={refreshData} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportData}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">Total Reach</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{formatNumber(analyticsData.overview.totalReach)}</p>
              <Eye className="w-5 h-5 text-cyan-500" />
            </div>
            <div className="flex items-center gap-1 mt-2">
              {getChangeIcon(12.5)}
              <span className={`text-sm ${getChangeColor(12.5)}`}>12.5%</span>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{formatNumber(analyticsData.overview.totalEngagement)}</p>
              <Heart className="w-5 h-5 text-pink-500" />
            </div>
            <div className="flex items-center gap-1 mt-2">
              {getChangeIcon(8.3)}
              <span className={`text-sm ${getChangeColor(8.3)}`}>8.3%</span>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">Followers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{formatNumber(analyticsData.overview.totalFollowers)}</p>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex items-center gap-1 mt-2">
              {getChangeIcon(analyticsData.overview.growthRate)}
              <span className={`text-sm ${getChangeColor(analyticsData.overview.growthRate)}`}>
                {analyticsData.overview.growthRate}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{analyticsData.overview.totalPosts}</p>
              <MessageSquare className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex items-center gap-1 mt-2">
              {getChangeIcon(23)}
              <span className={`text-sm ${getChangeColor(23)}`}>23 this week</span>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">Engagement Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{analyticsData.overview.engagementRate}%</p>
              <Zap className="w-5 h-5 text-yellow-500" />
            </div>
            <Progress value={analyticsData.overview.engagementRate * 10} className="mt-2" />
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">Growth Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{analyticsData.overview.growthRate}%</p>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <Progress value={analyticsData.overview.growthRate * 4} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement Over Time */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Engagement Over Time</CardTitle>
            <CardDescription>Daily engagement and reach trends</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analyticsData.performance.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="day" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  labelStyle={{ color: '#888' }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="engagement" 
                  stroke="#06b6d4" 
                  fill="#06b6d4" 
                  fillOpacity={0.3}
                  name="Engagement"
                />
                <Area 
                  type="monotone" 
                  dataKey="reach" 
                  stroke="#ec4899" 
                  fill="#ec4899" 
                  fillOpacity={0.3}
                  name="Reach"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Platform Distribution */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Platform Distribution</CardTitle>
            <CardDescription>Follower distribution across platforms</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={Object.entries(analyticsData.platforms).map(([platform, data]) => ({
                    name: platform.charAt(0).toUpperCase() + platform.slice(1),
                    value: data.followers
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {Object.keys(analyticsData.platforms).map((platform, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Platform Performance */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Platform Performance</CardTitle>
          <CardDescription>Detailed metrics for each social platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(analyticsData.platforms).map(([platform, data]) => {
              const Icon = platformIcons[platform as keyof typeof platformIcons] || Globe;
              const color = platformColors[platform as keyof typeof platformColors] || '#888';
              
              return (
                <div key={platform} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div>
                      <p className="font-medium capitalize">{platform}</p>
                      <p className="text-sm text-gray-400">
                        {formatNumber(data.followers)} followers
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Engagement</p>
                      <p className="font-medium">{formatNumber(data.engagement)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Posts</p>
                      <p className="font-medium">{data.posts}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Reach</p>
                      <p className="font-medium">{formatNumber(data.reach)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {getChangeIcon(data.growth)}
                      <span className={`text-sm font-medium ${getChangeColor(data.growth)}`}>
                        {data.growth}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Content & Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Content */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Top Performing Content</CardTitle>
            <CardDescription>Your best performing posts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsData.topContent.slice(0, 5).map((content) => {
                const Icon = platformIcons[content.platform as keyof typeof platformIcons] || Globe;
                
                return (
                  <div key={content.id} className="flex items-start justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex gap-3 flex-1">
                      <Icon className="w-4 h-4 mt-1 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm line-clamp-2">{content.content}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Heart className="w-3 h-3" /> {formatNumber(content.likes)}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> {formatNumber(content.comments)}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Share2 className="w-3 h-3" /> {formatNumber(content.shares)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {formatNumber(content.engagement)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Trending Hashtags */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Trending Hashtags</CardTitle>
            <CardDescription>Popular hashtags in your niche</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsData.trends.map((trend) => (
                <div key={trend.hashtag} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Target className="w-4 h-4 text-cyan-500" />
                    <div>
                      <p className="font-medium">{trend.hashtag}</p>
                      <p className="text-sm text-gray-400">{formatNumber(trend.mentions)} mentions</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={
                        trend.sentiment === 'positive' ? 'border-green-500 text-green-400' :
                        trend.sentiment === 'negative' ? 'border-red-500 text-red-400' :
                        'border-gray-500 text-gray-400'
                      }
                    >
                      {trend.sentiment}
                    </Badge>
                    <div className="flex items-center gap-1">
                      {getChangeIcon(trend.growth)}
                      <span className={`text-sm font-medium ${getChangeColor(trend.growth)}`}>
                        {Math.abs(trend.growth)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Demographics */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Audience Demographics</CardTitle>
          <CardDescription>Understanding your audience composition</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Age Distribution */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-3">Age Groups</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analyticsData.demographics.age}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="range" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  />
                  <Bar dataKey="percentage" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Gender Distribution */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-3">Gender</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={analyticsData.demographics.gender}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="percentage"
                  >
                    {analyticsData.demographics.gender.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {analyticsData.demographics.gender.map((item, index) => (
                  <div key={item.type} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm text-gray-400">
                      {item.type} ({item.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Locations */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-3">Top Locations</h4>
              <div className="space-y-2">
                {analyticsData.demographics.location.map((location, index) => (
                  <div key={location.country} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{location.country}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatNumber(location.users)}</span>
                      <Progress 
                        value={(location.users / analyticsData.demographics.location[0].users) * 100} 
                        className="w-20"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper functions to generate mock data
function generateHourlyData() {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    engagement: Math.floor(Math.random() * 500) + 100,
    reach: Math.floor(Math.random() * 2000) + 500
  }));
}

function generateDailyData() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map(day => ({
    day,
    engagement: Math.floor(Math.random() * 3000) + 1000,
    reach: Math.floor(Math.random() * 10000) + 5000,
    posts: Math.floor(Math.random() * 10) + 5
  }));
}

function generateWeeklyData() {
  return Array.from({ length: 4 }, (_, i) => ({
    week: `Week ${i + 1}`,
    engagement: Math.floor(Math.random() * 10000) + 5000,
    reach: Math.floor(Math.random() * 50000) + 20000
  }));
}

function generateTopContent() {
  const platforms = ['twitter', 'instagram', 'linkedin', 'youtube', 'facebook'];
  const contents = [
    "Just launched our new AI-powered content generator! 🚀 Check it out and transform your social media game",
    "5 tips for growing your audience in 2024: Thread 🧵",
    "Behind the scenes of our latest product launch. The journey was incredible!",
    "How we increased engagement by 300% in just 30 days (case study)",
    "The future of social media marketing is here. Are you ready?",
    "Our team just hit 10K followers! Thank you for your amazing support 🎉",
    "Breaking: Major algorithm update coming next week. Here\'s what you need to know",
    "Free template pack for content creators! Link in bio 📎"
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