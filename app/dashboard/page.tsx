'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonCard, SkeletonChart } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Activity,
  Wand2,
  BarChart2 as ChartBar,
  CalendarDays,
  BrainCircuit
} from '@/components/icons';
import { QuickStats } from '@/components/QuickStats';
import { StreakCounter } from '@/components/StreakCounter';
import { SmartSuggestions } from '@/components/SmartSuggestions';
import { TemplateSelector } from '@/components/TemplateSelector';
import { useMultiSelect, BulkActionsMenu } from '@/hooks/useMultiSelect';
import AIContentStudio from '@/components/AIContentStudio';
import RealTimeAnalytics from '@/components/RealTimeAnalytics';
import PostScheduler from '@/components/PostScheduler';
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

// Data will be fetched from API

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
  <Card variant="glass-interactive">
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
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const [showAutomationSetup, setShowAutomationSetup] = useState(false);
  const [features, setFeatures] = useState({ smartScheduling: false, trendDetection: false });
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState<any>({
    stats: {
      totalReach: 245780,
      totalEngagement: 18945,
      totalFollowers: 12456,
      totalPosts: 147,
      engagementRate: 7.71,
      growthRate: 12.5
    },
    engagementData: [
      { name: 'Mon', value: 4000 },
      { name: 'Tue', value: 3000 },
      { name: 'Wed', value: 5000 },
      { name: 'Thu', value: 2780 },
      { name: 'Fri', value: 6890 },
      { name: 'Sat', value: 7390 },
      { name: 'Sun', value: 5490 }
    ],
    platformData: [
      { platform: 'Twitter', engagement: 4500 },
      { platform: 'Instagram', engagement: 6200 },
      { platform: 'LinkedIn', engagement: 3800 },
      { platform: 'TikTok', engagement: 8900 },
      { platform: 'YouTube', engagement: 5400 }
    ],
    recentActivity: []
  });

  const handleFeatureToggle = (feature: keyof typeof features) => {
        setFeatures(prev => ({ ...prev, [feature]: !prev[feature] }));
        toast.success(`${feature} ${features[feature] ? 'disabled' : 'enabled'}`);
      };

  useEffect(() => {
    fetchDashboardData();
    const timer = setTimeout(() => setAiProgress(75), 500);
    return () => clearTimeout(timer);
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Simulated API call - replace with actual endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Welcome back!</h1>
          <p className="text-gray-400 mt-1">Your AI-powered marketing command center</p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <Button 
            className="gradient-primary text-white"
            onClick={() => setActiveTab('ai-studio')}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Content
          </Button>
          <Button 
            variant="outline" 
            className="bg-white/5 border-white/10 text-white hover:bg-white/10"
            onClick={() => setActiveTab('schedule')}
          >
            <Calendar className="mr-2 h-4 w-4" />
            View Schedule
          </Button>
        </div>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="overview">
            <Activity className="w-4 h-4 mr-2 hidden sm:inline" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="ai-studio">
            <Wand2 className="w-4 h-4 mr-2 hidden sm:inline" />
            AI Studio
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <ChartBar className="w-4 h-4 mr-2 hidden sm:inline" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <CalendarDays className="w-4 h-4 mr-2 hidden sm:inline" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="automation">
            <BrainCircuit className="w-4 h-4 mr-2 hidden sm:inline" />
            Automation
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats Widget */}
          <QuickStats />
          
          {/* Streak & Gamification */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <StreakCounter />
            </div>
            <Card variant="glass">
              <CardHeader>
                <CardTitle>Today's Goal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Posts Created</span>
                    <span className="text-white">3/5</span>
                  </div>
                  <Progress value={60} className="h-2" />
                  <p className="text-xs text-gray-400">2 more posts to complete your daily goal!</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Engagement Chart */}
            <Card variant="glass" className="col-span-1">
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
                  <AreaChart data={dashboardData.engagementData}>
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
            <Card variant="glass" className="col-span-1">
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
                  <BarChart data={dashboardData.platformData}>
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
            <Card variant="glass">
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
            <Card variant="glass">
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
            <Card variant="glass">
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
          
          {/* Smart Suggestions Section */}
          <div className="mt-6">
            <SmartSuggestions context={{ dashboard: true }} compact={false} />
          </div>
        </TabsContent>

        {/* AI Studio Tab */}
        <TabsContent value="ai-studio" className="space-y-6">
          <AIContentStudio />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <RealTimeAnalytics />
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-6">
          <PostScheduler />
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-6">
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-purple-500" />
                Smart Automation
              </CardTitle>
              <CardDescription>AI-powered workflows and optimization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-white/5 rounded-lg">
                  <h3 className="font-semibold mb-2">Auto-Optimization</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    AI automatically optimizes your content for maximum engagement
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => router.push("/dashboard/settings")}>Configure</Button>
                </div>
                <div className="p-6 bg-white/5 rounded-lg">
                  <h3 className="font-semibold mb-2">Smart Scheduling</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Post at optimal times based on audience activity patterns
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => handleFeatureToggle("smartScheduling")}>Enable</Button>
                </div>
                <div className="p-6 bg-white/5 rounded-lg">
                  <h3 className="font-semibold mb-2">Response Automation</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    AI-powered responses to comments and messages
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => setShowAutomationSetup(true)}>Set Up</Button>
                </div>
                <div className="p-6 bg-white/5 rounded-lg">
                  <h3 className="font-semibold mb-2">Trend Detection</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Automatically identify and capitalize on trending topics
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => handleFeatureToggle("trendDetection")}>Activate</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}