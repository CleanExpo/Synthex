'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Clock,
  Calendar,
  Download,
  Filter,
  BarChart3,
  LineChart,
  PieChart,
  Activity,
  Target,
  Award,
  AlertCircle,
  CheckCircle,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Video,
} from 'lucide-react';
import {
  LineChart as RechartsLineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

// Platform colors
const platformColors = {
  twitter: '#1DA1F2',
  linkedin: '#0077B5',
  instagram: '#E4405F',
  facebook: '#1877F2',
  tiktok: '#000000',
};

// Mock data for charts
const engagementData = [
  { date: 'Mon', twitter: 4000, linkedin: 2400, instagram: 2400, tiktok: 3200 },
  { date: 'Tue', twitter: 3000, linkedin: 1398, instagram: 2210, tiktok: 4100 },
  { date: 'Wed', twitter: 2000, linkedin: 9800, instagram: 2290, tiktok: 3800 },
  { date: 'Thu', twitter: 2780, linkedin: 3908, instagram: 2000, tiktok: 4300 },
  { date: 'Fri', twitter: 1890, linkedin: 4800, instagram: 2181, tiktok: 5200 },
  { date: 'Sat', twitter: 2390, linkedin: 3800, instagram: 2500, tiktok: 6100 },
  { date: 'Sun', twitter: 3490, linkedin: 4300, instagram: 2100, tiktok: 7200 },
];

const platformDistribution = [
  { name: 'Twitter', value: 35, color: platformColors.twitter },
  { name: 'LinkedIn', value: 25, color: platformColors.linkedin },
  { name: 'Instagram', value: 20, color: platformColors.instagram },
  { name: 'TikTok', value: 15, color: platformColors.tiktok },
  { name: 'Facebook', value: 5, color: platformColors.facebook },
];

const contentPerformance = [
  { type: 'Educational', engagement: 85, reach: 75, clicks: 65 },
  { type: 'Entertainment', engagement: 92, reach: 88, clicks: 70 },
  { type: 'News', engagement: 78, reach: 82, clicks: 60 },
  { type: 'Promotional', engagement: 65, reach: 70, clicks: 80 },
  { type: 'Personal', engagement: 88, reach: 65, clicks: 55 },
];

const growthData = [
  { month: 'Jan', followers: 1200, engagement: 4.5 },
  { month: 'Feb', followers: 1800, engagement: 5.2 },
  { month: 'Mar', followers: 2400, engagement: 5.8 },
  { month: 'Apr', followers: 3200, engagement: 6.1 },
  { month: 'May', followers: 4100, engagement: 6.8 },
  { month: 'Jun', followers: 5200, engagement: 7.2 },
];

const topPosts = [
  {
    id: 1,
    platform: 'twitter',
    content: 'Just shipped our new AI feature! 🚀',
    engagement: 12500,
    impressions: 145000,
    date: '2 days ago',
  },
  {
    id: 2,
    platform: 'linkedin',
    content: '5 lessons from building a startup...',
    engagement: 8900,
    impressions: 98000,
    date: '5 days ago',
  },
  {
    id: 3,
    platform: 'instagram',
    content: 'Behind the scenes of our product launch',
    engagement: 15600,
    impressions: 178000,
    date: '1 week ago',
  },
];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('7d');
  const [platform, setPlatform] = useState('all');

  const PlatformIcon = ({ platform }: { platform: string }) => {
    const icons = {
      twitter: Twitter,
      linkedin: Linkedin,
      instagram: Instagram,
      facebook: Facebook,
      tiktok: Video,
    };
    const Icon = icons[platform as keyof typeof icons];
    return Icon ? <Icon className="h-4 w-4" /> : null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Analytics Dashboard</h1>
          <p className="text-gray-400 mt-1">
            Track your social media performance and insights
          </p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px] bg-white/5 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button className="gradient-primary text-white">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Reach</CardTitle>
            <Eye className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">2.4M</div>
            <div className="flex items-center mt-1">
              <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-xs text-green-500">+18.2%</span>
              <span className="text-xs text-gray-500 ml-1">from last period</span>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Engagement</CardTitle>
            <Heart className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">184.5K</div>
            <div className="flex items-center mt-1">
              <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-xs text-green-500">+12.5%</span>
              <span className="text-xs text-gray-500 ml-1">from last period</span>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Engagement Rate</CardTitle>
            <Activity className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">7.8%</div>
            <div className="flex items-center mt-1">
              <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              <span className="text-xs text-red-500">-0.3%</span>
              <span className="text-xs text-gray-500 ml-1">from last period</span>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Follower Growth</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">+12.4K</div>
            <div className="flex items-center mt-1">
              <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-xs text-green-500">+24.8%</span>
              <span className="text-xs text-gray-500 ml-1">from last period</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Engagement Trend */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Engagement Trend</CardTitle>
            <CardDescription className="text-gray-400">
              Daily engagement across platforms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={engagementData}>
                <defs>
                  <linearGradient id="colorTwitter" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={platformColors.twitter} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={platformColors.twitter} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorLinkedin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={platformColors.linkedin} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={platformColors.linkedin} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorInstagram" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={platformColors.instagram} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={platformColors.instagram} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    border: '1px solid #333',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="twitter"
                  stroke={platformColors.twitter}
                  fillOpacity={1}
                  fill="url(#colorTwitter)"
                />
                <Area
                  type="monotone"
                  dataKey="linkedin"
                  stroke={platformColors.linkedin}
                  fillOpacity={1}
                  fill="url(#colorLinkedin)"
                />
                <Area
                  type="monotone"
                  dataKey="instagram"
                  stroke={platformColors.instagram}
                  fillOpacity={1}
                  fill="url(#colorInstagram)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Platform Distribution */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Platform Distribution</CardTitle>
            <CardDescription className="text-gray-400">
              Engagement by platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={platformDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {platformDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    border: '1px solid #333',
                    borderRadius: '8px',
                  }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Content Performance */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Content Performance by Type</CardTitle>
          <CardDescription className="text-gray-400">
            Engagement metrics by content category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={contentPerformance}>
              <PolarGrid stroke="#333" />
              <PolarAngleAxis dataKey="type" stroke="#666" />
              <PolarRadiusAxis stroke="#666" />
              <Radar
                name="Engagement"
                dataKey="engagement"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.3}
              />
              <Radar
                name="Reach"
                dataKey="reach"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
              />
              <Radar
                name="Clicks"
                dataKey="clicks"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.3}
              />
              <Legend />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  border: '1px solid #333',
                  borderRadius: '8px',
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Growth & Top Posts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Follower Growth */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Growth Metrics</CardTitle>
            <CardDescription className="text-gray-400">
              Follower growth and engagement rate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsLineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" stroke="#666" />
                <YAxis yAxisId="left" stroke="#666" />
                <YAxis yAxisId="right" orientation="right" stroke="#666" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    border: '1px solid #333',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="followers"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  name="Followers"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="engagement"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Engagement %"
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Posts */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Top Performing Posts</CardTitle>
            <CardDescription className="text-gray-400">
              Your best content this period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start space-x-3">
                    <PlatformIcon platform={post.platform} />
                    <div>
                      <p className="text-sm text-white truncate max-w-[250px]">
                        {post.content}
                      </p>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-gray-400 flex items-center">
                          <Eye className="h-3 w-3 mr-1" />
                          {(post.impressions / 1000).toFixed(1)}K
                        </span>
                        <span className="text-xs text-gray-400 flex items-center">
                          <Heart className="h-3 w-3 mr-1" />
                          {(post.engagement / 1000).toFixed(1)}K
                        </span>
                        <span className="text-xs text-gray-500">{post.date}</span>
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-gray-400">
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              className="w-full mt-4 bg-white/5 border-white/10 text-white hover:bg-white/10"
            >
              View All Posts
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Detailed Metrics</CardTitle>
          <CardDescription className="text-gray-400">
            Platform-specific performance data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="bg-white/5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="engagement">Engagement</TabsTrigger>
              <TabsTrigger value="audience">Audience</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 text-gray-400 font-medium">Platform</th>
                      <th className="text-right py-2 text-gray-400 font-medium">Followers</th>
                      <th className="text-right py-2 text-gray-400 font-medium">Posts</th>
                      <th className="text-right py-2 text-gray-400 font-medium">Engagement</th>
                      <th className="text-right py-2 text-gray-400 font-medium">Reach</th>
                      <th className="text-right py-2 text-gray-400 font-medium">Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['Twitter', 'LinkedIn', 'Instagram', 'TikTok', 'Facebook'].map((platform) => (
                      <tr key={platform} className="border-b border-white/5">
                        <td className="py-3 text-white">{platform}</td>
                        <td className="text-right py-3 text-gray-300">
                          {Math.floor(Math.random() * 50000 + 10000).toLocaleString()}
                        </td>
                        <td className="text-right py-3 text-gray-300">
                          {Math.floor(Math.random() * 100 + 20)}
                        </td>
                        <td className="text-right py-3 text-gray-300">
                          {(Math.random() * 10 + 2).toFixed(1)}%
                        </td>
                        <td className="text-right py-3 text-gray-300">
                          {Math.floor(Math.random() * 500000 + 100000).toLocaleString()}
                        </td>
                        <td className="text-right py-3">
                          <span className="text-green-500">
                            +{(Math.random() * 30 + 5).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}