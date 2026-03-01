'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Heart,
  MessageSquare,
  Share2,
  TrendingUp,
  Clock,
  Zap,
  Globe,
  Twitter,
  Instagram,
  Linkedin,
  Facebook,
  Youtube,
} from '@/components/icons';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { Competitor, PlatformMetrics } from './types';

interface CompetitorDetailViewProps {
  competitor: Competitor;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const getPlatformIcon = (platform: string) => {
  const icons: Record<string, React.ElementType> = {
    twitter: Twitter,
    instagram: Instagram,
    linkedin: Linkedin,
    facebook: Facebook,
    youtube: Youtube,
    tiktok: Zap,
  };
  return icons[platform] || Globe;
};

export function CompetitorDetailView({ competitor, activeTab, onTabChange }: CompetitorDetailViewProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{competitor.name}</CardTitle>
            <CardDescription>{competitor.description}</CardDescription>
          </div>
          <Badge>{competitor.size}</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={onTabChange}>
          <TabsList className="grid grid-cols-4 bg-white/5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="swot">SWOT</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div>
              <h4 className="font-medium text-white mb-3">Platform Performance</h4>
              <div className="grid gap-3">
                {Object.entries(competitor.metrics.followers)
                  .filter(([key]) => key !== 'total' && competitor.metrics.followers[key as keyof PlatformMetrics])
                  .map(([platform, followers]) => {
                    const Icon = getPlatformIcon(platform);
                    const engagement = competitor.metrics.engagement[platform as keyof PlatformMetrics] || 0;
                    return (
                      <div key={platform} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                        <Icon className="h-5 w-5 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white capitalize">{platform}</p>
                          <p className="text-xs text-gray-400">
                            {(followers as number).toLocaleString()} followers &bull; {engagement}% engagement
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {competitor.metrics.postFrequency[platform as keyof PlatformMetrics]}/day
                        </Badge>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-white mb-3">Content Performance</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-white/5 rounded-lg text-center">
                  <Heart className="h-5 w-5 text-red-400 mx-auto mb-2" />
                  <p className="text-lg font-bold text-white">{competitor.metrics.contentPerformance.avgLikes.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">Avg Likes</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg text-center">
                  <MessageSquare className="h-5 w-5 text-blue-400 mx-auto mb-2" />
                  <p className="text-lg font-bold text-white">{competitor.metrics.contentPerformance.avgComments}</p>
                  <p className="text-xs text-gray-400">Avg Comments</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg text-center">
                  <Share2 className="h-5 w-5 text-green-400 mx-auto mb-2" />
                  <p className="text-lg font-bold text-white">{competitor.metrics.contentPerformance.avgShares}</p>
                  <p className="text-xs text-gray-400">Avg Shares</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg text-center">
                  <TrendingUp className="h-5 w-5 text-cyan-400 mx-auto mb-2" />
                  <p className="text-lg font-bold text-white">{competitor.metrics.contentPerformance.viralPosts}</p>
                  <p className="text-xs text-gray-400">Viral Posts</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-6">
            <div>
              <h4 className="font-medium text-white mb-3">Content Mix</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={competitor.contentStrategy.contentTypes} dataKey="percentage" nameKey="type" cx="50%" cy="50%" outerRadius={80} label>
                      {competitor.contentStrategy.contentTypes.map((_, index) => (
                        <Cell key={index} fill={['#06b6d4', '#ec4899', '#3b82f6', '#10b981'][index]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-white mb-3">Optimal Posting Times</h4>
              <div className="flex gap-2">
                {competitor.contentStrategy.postingTimes.map(time => (
                  <Badge key={time} variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    {time}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-white mb-3">Top Hashtags</h4>
              <div className="flex flex-wrap gap-2">
                {competitor.contentStrategy.hashtagStrategy.map(tag => (
                  <Badge key={tag} className="bg-cyan-500/20 text-cyan-400">{tag}</Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* SWOT Tab */}
          <TabsContent value="swot" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <h4 className="font-medium text-green-400 mb-3">Strengths</h4>
                <ul className="space-y-2">
                  {competitor.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-green-400">&bull;</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <h4 className="font-medium text-red-400 mb-3">Weaknesses</h4>
                <ul className="space-y-2">
                  {competitor.weaknesses.map((w, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-red-400">&bull;</span>{w}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg md:col-span-2">
                <h4 className="font-medium text-blue-400 mb-3">Opportunities</h4>
                <ul className="space-y-2">
                  {competitor.opportunities.map((o, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-blue-400">&bull;</span>{o}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-5 w-5 text-cyan-400" />
                <h4 className="font-medium text-white">AI Insights</h4>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-black/20 rounded">
                  <p className="text-sm text-gray-300">
                    <strong className="text-white">Growth Opportunity:</strong> {competitor.name} has
                    strong engagement on Instagram ({competitor.metrics.engagement.instagram}%) but
                    relatively low posting frequency. Increasing posts could drive significant growth.
                  </p>
                </div>
                <div className="p-3 bg-black/20 rounded">
                  <p className="text-sm text-gray-300">
                    <strong className="text-white">Content Gap:</strong> Only 20% user-generated content
                    despite high engagement rates. Encouraging more UGC could boost authenticity.
                  </p>
                </div>
                <div className="p-3 bg-black/20 rounded">
                  <p className="text-sm text-gray-300">
                    <strong className="text-white">Platform Strategy:</strong> Consider their TikTok absence
                    as an opportunity to capture younger audience before they establish presence.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
