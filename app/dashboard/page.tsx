'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  Users, 
  FileText, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Clock,
  Target,
  Zap,
  BarChart3,
  Activity
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Mock data for charts
const engagementData = [
  { name: 'Mon', value: 2400 },
  { name: 'Tue', value: 3600 },
  { name: 'Wed', value: 3200 },
  { name: 'Thu', value: 4100 },
  { name: 'Fri', value: 4900 },
  { name: 'Sat', value: 5200 },
  { name: 'Sun', value: 4800 },
];

const platformData = [
  { platform: 'Twitter', posts: 45, engagement: 12000 },
  { platform: 'LinkedIn', posts: 32, engagement: 8500 },
  { platform: 'Instagram', posts: 58, engagement: 15000 },
  { platform: 'TikTok', posts: 28, engagement: 22000 },
  { platform: 'Facebook', posts: 35, engagement: 6000 },
];

const StatCard = ({ 
  title, 
  value, 
  change, 
  changeType, 
  icon: Icon,
  description 
}: {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  icon: React.ElementType;
  description?: string;
}) => (
  <Card className="glass-card hover:scale-105 transition-transform">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
      <Icon className="h-4 w-4 text-purple-500" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-white">{value}</div>
      {description && (
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      )}
      {change && (
        <div className="flex items-center mt-2">
          {changeType === 'positive' ? (
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-red-500" />
          )}
          <span className={`text-xs ml-1 ${
            changeType === 'positive' ? 'text-green-500' : 'text-red-500'
          }`}>
            {change}
          </span>
        </div>
      )}
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  const [aiProgress, setAiProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAiProgress(75), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Welcome back, John!</h1>
          <p className="text-gray-400 mt-1">Here's what's happening with your social media today</p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <Button className="gradient-primary text-white">
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Content
          </Button>
          <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10">
            <Calendar className="mr-2 h-4 w-4" />
            View Schedule
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Engagement"
          value="128.5K"
          change="+12.5% from last week"
          changeType="positive"
          icon={TrendingUp}
        />
        <StatCard
          title="Active Campaigns"
          value="12"
          description="3 launching this week"
          icon={Target}
        />
        <StatCard
          title="Content Generated"
          value="847"
          change="+23% from last month"
          changeType="positive"
          icon={FileText}
        />
        <StatCard
          title="Audience Growth"
          value="+4,235"
          change="+8.2% growth rate"
          changeType="positive"
          icon={Users}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Engagement Chart */}
        <Card className="glass-card col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Weekly Engagement</span>
              <Activity className="h-4 w-4 text-purple-500" />
            </CardTitle>
            <CardDescription className="text-gray-400">
              Your engagement trends over the past week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={engagementData}>
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px'
                  }}
                />
                <Area type="monotone" dataKey="value" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Platform Performance */}
        <Card className="glass-card col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Platform Performance</span>
              <BarChart3 className="h-4 w-4 text-purple-500" />
            </CardTitle>
            <CardDescription className="text-gray-400">
              Engagement by social platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={platformData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="platform" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="engagement" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Additional Sections */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* AI Content Queue */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>AI Content Queue</span>
              <Zap className="h-4 w-4 text-purple-500" />
            </CardTitle>
            <CardDescription className="text-gray-400">
              Content being generated
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Processing</span>
                <span className="text-white">{aiProgress}%</span>
              </div>
              <Progress value={aiProgress} className="h-2" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-sm">LinkedIn Article</span>
                <span className="text-xs text-green-400">Complete</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-sm">Twitter Thread</span>
                <span className="text-xs text-yellow-400">Processing</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-sm">Instagram Carousel</span>
                <span className="text-xs text-gray-400">Queued</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Posts */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Upcoming Posts</span>
              <Clock className="h-4 w-4 text-purple-500" />
            </CardTitle>
            <CardDescription className="text-gray-400">
              Scheduled for today
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <div>
                  <p className="text-sm font-medium">Product Launch Teaser</p>
                  <p className="text-xs text-gray-400">Twitter • 2:00 PM</p>
                </div>
                <Button size="sm" variant="ghost" className="text-purple-400">
                  Edit
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <div>
                  <p className="text-sm font-medium">Behind the Scenes</p>
                  <p className="text-xs text-gray-400">Instagram • 4:30 PM</p>
                </div>
                <Button size="sm" variant="ghost" className="text-purple-400">
                  Edit
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <div>
                  <p className="text-sm font-medium">Industry Insights</p>
                  <p className="text-xs text-gray-400">LinkedIn • 6:00 PM</p>
                </div>
                <Button size="sm" variant="ghost" className="text-purple-400">
                  Edit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Performing Content */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Top Performing</span>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardTitle>
            <CardDescription className="text-gray-400">
              Your best content this week
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-white/5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">AI Tools Comparison</p>
                  <span className="text-xs text-green-400">↑ 234%</span>
                </div>
                <p className="text-xs text-gray-400">LinkedIn • 45K impressions</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">Quick Tutorial Video</p>
                  <span className="text-xs text-green-400">↑ 189%</span>
                </div>
                <p className="text-xs text-gray-400">TikTok • 128K views</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">Meme Monday</p>
                  <span className="text-xs text-green-400">↑ 156%</span>
                </div>
                <p className="text-xs text-gray-400">Twitter • 892 retweets</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}