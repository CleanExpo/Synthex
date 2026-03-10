'use client';

/**
 * Metrics Table Component
 * Detailed metrics table with tabs
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

const defaultPlatforms = ['Twitter', 'LinkedIn', 'Instagram', 'TikTok', 'Facebook'];

export interface MetricsTableRow {
  platform: string;
  followers: number;
  posts: number;
  engagement: number;
  reach: number;
  growth: number;
}

export interface EngagementTableRow {
  platform: string;
  likes: number;
  comments: number;
  shares: number;
  total: number;
}

export interface ContentTableRow {
  platform: string;
  topPosts: number;
  avgEngagementRate: number;
  bestTime: string;
}

interface MetricsTableProps {
  data?: MetricsTableRow[];
  engagementData?: EngagementTableRow[];
  contentData?: ContentTableRow[];
}

const EM_DASH = '\u2014';

export function MetricsTable({ data, engagementData, contentData }: MetricsTableProps) {
  const hasData = data && data.length > 0;
  const hasEngagementData = engagementData && engagementData.length > 0;
  const hasContentData = contentData && contentData.length > 0;

  const overviewPlatforms = hasData ? data.map(d => d.platform) : defaultPlatforms;
  const engagementPlatforms = hasEngagementData
    ? engagementData.map(d => d.platform)
    : defaultPlatforms;
  const contentPlatforms = hasContentData ? contentData.map(d => d.platform) : defaultPlatforms;

  // Audience tab derives from engagementData or data (whichever is available)
  const audiencePlatforms = hasEngagementData
    ? engagementData.map(d => d.platform)
    : hasData
    ? data.map(d => d.platform)
    : defaultPlatforms;

  const getOverviewRow = (platform: string) => {
    if (hasData) return data.find(d => d.platform === platform);
    return null;
  };

  const getEngagementRow = (platform: string) => {
    if (hasEngagementData) return engagementData.find(d => d.platform === platform);
    return null;
  };

  const getContentRow = (platform: string) => {
    if (hasContentData) return contentData.find(d => d.platform === platform);
    return null;
  };

  // Audience data derived from engagementData or data
  const getAudienceRow = (platform: string) => {
    if (hasEngagementData) {
      const eng = engagementData.find(d => d.platform === platform);
      if (eng) {
        const rate = eng.total > 0
          ? ((eng.likes + eng.comments + eng.shares) / eng.total * 100).toFixed(1)
          : EM_DASH;
        return { engagementRate: rate, growthTrend: 'Stable', bestTime: EM_DASH };
      }
    }
    if (hasData) {
      const row = data.find(d => d.platform === platform);
      if (row) {
        const growthLabel = row.growth > 0 ? 'Growing' : row.growth < 0 ? 'Declining' : 'Stable';
        return {
          engagementRate: `${row.engagement.toFixed(1)}%`,
          growthTrend: growthLabel,
          bestTime: EM_DASH,
        };
      }
    }
    return null;
  };

  const formatNumber = (n: number) => n.toLocaleString();

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Detailed Metrics</CardTitle>
        <CardDescription className="text-slate-400">
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

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 text-slate-400 font-medium">Platform</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Followers</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Posts</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Engagement</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Reach</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Growth</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewPlatforms.map((platform) => {
                    const row = getOverviewRow(platform);
                    return (
                      <tr key={platform} className="border-b border-white/5">
                        <td className="py-3 text-white">{platform}</td>
                        <td className="text-right py-3 text-slate-300">
                          {row ? row.followers.toLocaleString() : EM_DASH}
                        </td>
                        <td className="text-right py-3 text-slate-300">
                          {row ? row.posts : EM_DASH}
                        </td>
                        <td className="text-right py-3 text-slate-300">
                          {row ? `${row.engagement.toFixed(1)}%` : EM_DASH}
                        </td>
                        <td className="text-right py-3 text-slate-300">
                          {row ? row.reach.toLocaleString() : EM_DASH}
                        </td>
                        <td className="text-right py-3">
                          {row ? (
                            <span className={row.growth >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {row.growth >= 0 ? '+' : ''}{row.growth.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-300">{EM_DASH}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Engagement Tab */}
          <TabsContent value="engagement" className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 text-slate-400 font-medium">Platform</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Likes</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Comments</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Shares</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Total Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {engagementPlatforms.map((platform) => {
                    const row = getEngagementRow(platform);
                    return (
                      <tr key={platform} className="border-b border-white/5">
                        <td className="py-3 text-white">{platform}</td>
                        <td className="text-right py-3 text-slate-300">
                          {row ? formatNumber(row.likes) : EM_DASH}
                        </td>
                        <td className="text-right py-3 text-slate-300">
                          {row ? formatNumber(row.comments) : EM_DASH}
                        </td>
                        <td className="text-right py-3 text-slate-300">
                          {row ? formatNumber(row.shares) : EM_DASH}
                        </td>
                        <td className="text-right py-3 text-white font-medium">
                          {row ? formatNumber(row.total) : EM_DASH}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Audience Tab */}
          <TabsContent value="audience" className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 text-slate-400 font-medium">Platform</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Engagement Rate</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Growth Trend</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Best Time</th>
                  </tr>
                </thead>
                <tbody>
                  {audiencePlatforms.map((platform) => {
                    const row = getAudienceRow(platform);
                    const trendColor =
                      row?.growthTrend === 'Growing'
                        ? 'text-green-500'
                        : row?.growthTrend === 'Declining'
                        ? 'text-red-500'
                        : 'text-slate-300';
                    return (
                      <tr key={platform} className="border-b border-white/5">
                        <td className="py-3 text-white">{platform}</td>
                        <td className="text-right py-3 text-slate-300">
                          {row ? row.engagementRate : EM_DASH}
                        </td>
                        <td className={`text-right py-3 ${row ? trendColor : 'text-slate-300'}`}>
                          {row ? row.growthTrend : EM_DASH}
                        </td>
                        <td className="text-right py-3 text-slate-300">
                          {row ? row.bestTime : EM_DASH}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 text-slate-400 font-medium">Platform</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Posts</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Avg Engagement Rate</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Best Posting Time</th>
                  </tr>
                </thead>
                <tbody>
                  {contentPlatforms.map((platform) => {
                    const row = getContentRow(platform);
                    return (
                      <tr key={platform} className="border-b border-white/5">
                        <td className="py-3 text-white">{platform}</td>
                        <td className="text-right py-3 text-slate-300">
                          {row ? row.topPosts : EM_DASH}
                        </td>
                        <td className="text-right py-3 text-slate-300">
                          {row ? `${row.avgEngagementRate.toFixed(1)}%` : EM_DASH}
                        </td>
                        <td className="text-right py-3 text-slate-300">
                          {row ? row.bestTime : EM_DASH}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
