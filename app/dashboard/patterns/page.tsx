'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  Search,
  Filter,
  Download,
  RefreshCw,
  Sparkles,
  Clock,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  BookmarkPlus,
  BarChart3,
  Zap,
  AlertCircle,
  ChevronRight,
  Activity,
} from '@/components/icons';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import toast from 'react-hot-toast';

// Mock data for viral patterns
const viralPatterns = [
  {
    id: 1,
    platform: 'Twitter',
    content: 'Just shipped a new feature that our users have been asking for! 🚀',
    type: 'Product Update',
    engagement: 45600,
    impressions: 234000,
    shares: 892,
    hookType: 'Achievement',
    timing: '2:00 PM EST',
    sentiment: 0.85,
    viralityScore: 92,
    growthRate: '+234%',
  },
  {
    id: 2,
    platform: 'LinkedIn',
    content: 'Here are 5 lessons I learned from failing my first startup...',
    type: 'Educational',
    engagement: 28900,
    impressions: 156000,
    shares: 567,
    hookType: 'Vulnerability',
    timing: '9:00 AM EST',
    sentiment: 0.72,
    viralityScore: 88,
    growthRate: '+189%',
  },
  {
    id: 3,
    platform: 'TikTok',
    content: 'POV: You finally understand how AI works',
    type: 'Entertainment',
    engagement: 128000,
    impressions: 890000,
    shares: 12400,
    hookType: 'Relatable',
    timing: '7:00 PM EST',
    sentiment: 0.91,
    viralityScore: 95,
    growthRate: '+567%',
  },
];

const engagementData = [
  { hour: '12am', twitter: 2400, linkedin: 1200, tiktok: 3400, instagram: 2800 },
  { hour: '6am', twitter: 3200, linkedin: 2800, tiktok: 2200, instagram: 3100 },
  { hour: '12pm', twitter: 5600, linkedin: 4200, tiktok: 4800, instagram: 5200 },
  { hour: '6pm', twitter: 7800, linkedin: 3500, tiktok: 8900, instagram: 7600 },
  { hour: '11pm', twitter: 4200, linkedin: 1800, tiktok: 6200, instagram: 5400 },
];

const hookTypes = [
  { name: 'Question', value: 30, color: '#8b5cf6' },
  { name: 'Story', value: 25, color: '#ec4899' },
  { name: 'Controversy', value: 20, color: '#f59e0b' },
  { name: 'Data', value: 15, color: '#10b981' },
  { name: 'Humor', value: 10, color: '#3b82f6' },
];

const platformMetrics = [
  { platform: 'Twitter', metric: 'Engagement', value: 85 },
  { platform: 'Twitter', metric: 'Reach', value: 72 },
  { platform: 'Twitter', metric: 'Virality', value: 90 },
  { platform: 'LinkedIn', metric: 'Engagement', value: 78 },
  { platform: 'LinkedIn', metric: 'Reach', value: 65 },
  { platform: 'LinkedIn', metric: 'Virality', value: 70 },
  { platform: 'TikTok', metric: 'Engagement', value: 95 },
  { platform: 'TikTok', metric: 'Reach', value: 88 },
  { platform: 'TikTok', metric: 'Virality', value: 92 },
];

export default function ViralPatternsPage() {
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    // Simulate analysis progress
    const interval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsAnalyzing(false);
          toast.success('Analysis complete! New patterns discovered.');
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const filteredPatterns = viralPatterns.filter((pattern) => {
    const matchesPlatform = selectedPlatform === 'all' || pattern.platform.toLowerCase() === selectedPlatform;
    const matchesSearch = pattern.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          pattern.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPlatform && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Viral Pattern Analyzer</h1>
          <p className="text-gray-400 mt-1">
            Discover what makes content go viral across platforms
          </p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="gradient-primary text-white"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Analyze New
              </>
            )}
          </Button>
          <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Analysis Progress */}
      {isAnalyzing && (
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Analyzing viral patterns...</span>
                <span className="text-white">{analysisProgress}%</span>
              </div>
              <Progress value={analysisProgress} className="h-2" />
              <p className="text-xs text-gray-500">
                Scanning top posts across Twitter, LinkedIn, TikTok, and Instagram
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="platform" className="text-gray-400">Platform</Label>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="twitter">Twitter</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="timerange" className="text-gray-400">Time Range</Label>
              <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="search" className="text-gray-400">Search Patterns</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  id="search"
                  type="text"
                  placeholder="Search by content or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Insights */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Avg Virality Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">91.7</div>
            <p className="text-xs text-gray-500 mt-1">+12.3% from last week</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Best Time to Post</CardTitle>
            <Clock className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">2-3 PM</div>
            <p className="text-xs text-gray-500 mt-1">Peak engagement window</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Top Hook Type</CardTitle>
            <Zap className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">Questions</div>
            <p className="text-xs text-gray-500 mt-1">30% of viral posts</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Avg Growth Rate</CardTitle>
            <Activity className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">+327%</div>
            <p className="text-xs text-gray-500 mt-1">First 24 hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Engagement Timeline */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Engagement Timeline</span>
              <BarChart3 className="h-4 w-4 text-purple-500" />
            </CardTitle>
            <CardDescription className="text-gray-400">
              Peak engagement times by platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={engagementData}>
                <defs>
                  <linearGradient id="colorTwitter" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1DA1F2" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#1DA1F2" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorLinkedIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0077B5" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#0077B5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorTikTok" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF0050" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#FF0050" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="hour" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="twitter"
                  stroke="#1DA1F2"
                  fillOpacity={1}
                  fill="url(#colorTwitter)"
                />
                <Area
                  type="monotone"
                  dataKey="linkedin"
                  stroke="#0077B5"
                  fillOpacity={1}
                  fill="url(#colorLinkedIn)"
                />
                <Area
                  type="monotone"
                  dataKey="tiktok"
                  stroke="#FF0050"
                  fillOpacity={1}
                  fill="url(#colorTikTok)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hook Types Distribution */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Viral Hook Types</span>
              <Sparkles className="h-4 w-4 text-purple-500" />
            </CardTitle>
            <CardDescription className="text-gray-400">
              Most effective content hooks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={hookTypes}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {hookTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Viral Patterns */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Top Viral Patterns</span>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardTitle>
          <CardDescription className="text-gray-400">
            Highest performing content patterns this week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredPatterns.map((pattern) => (
              <div
                key={pattern.id}
                className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">
                        {pattern.platform}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                        {pattern.type}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                        {pattern.hookType}
                      </span>
                    </div>
                    <p className="text-white mb-3">{pattern.content}</p>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-1 text-gray-400">
                        <Eye className="w-4 h-4" />
                        <span>{(pattern.impressions / 1000).toFixed(0)}K</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-400">
                        <Heart className="w-4 h-4" />
                        <span>{(pattern.engagement / 1000).toFixed(0)}K</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-400">
                        <Share2 className="w-4 h-4" />
                        <span>{pattern.shares}</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span>{pattern.timing}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-white">{pattern.viralityScore}</div>
                    <div className="text-xs text-gray-400">Virality Score</div>
                    <div className="text-sm text-green-400 mt-1">{pattern.growthRate}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Sentiment:</span>
                    <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                        style={{ width: `${pattern.sentiment * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{(pattern.sentiment * 100).toFixed(0)}%</span>
                  </div>
                  <Button size="sm" variant="ghost" className="text-purple-400 hover:text-purple-300">
                    Analyze Pattern
                    <ChevronRight className="ml-1 w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Platform Performance Radar */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Platform Performance Matrix</span>
            <Activity className="h-4 w-4 text-purple-500" />
          </CardTitle>
          <CardDescription className="text-gray-400">
            Comparative analysis across platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={[
              { metric: 'Engagement', twitter: 85, linkedin: 78, tiktok: 95, instagram: 88 },
              { metric: 'Reach', twitter: 72, linkedin: 65, tiktok: 88, instagram: 82 },
              { metric: 'Virality', twitter: 90, linkedin: 70, tiktok: 92, instagram: 85 },
              { metric: 'Consistency', twitter: 75, linkedin: 85, tiktok: 70, instagram: 80 },
              { metric: 'Growth', twitter: 80, linkedin: 75, tiktok: 95, instagram: 90 },
            ]}>
              <PolarGrid stroke="#333" />
              <PolarAngleAxis dataKey="metric" stroke="#666" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#666" />
              <Radar name="Twitter" dataKey="twitter" stroke="#1DA1F2" fill="#1DA1F2" fillOpacity={0.3} />
              <Radar name="LinkedIn" dataKey="linkedin" stroke="#0077B5" fill="#0077B5" fillOpacity={0.3} />
              <Radar name="TikTok" dataKey="tiktok" stroke="#FF0050" fill="#FF0050" fillOpacity={0.3} />
              <Radar name="Instagram" dataKey="instagram" stroke="#E4405F" fill="#E4405F" fillOpacity={0.3} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}