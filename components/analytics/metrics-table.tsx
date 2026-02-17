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

interface MetricsTableProps {
  data?: MetricsTableRow[];
}

export function MetricsTable({ data }: MetricsTableProps) {
  const hasData = data && data.length > 0;
  const platforms = hasData ? data.map(d => d.platform) : defaultPlatforms;

  const getRowData = (platform: string) => {
    if (hasData) {
      return data.find(d => d.platform === platform);
    }
    return null;
  };

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
                  {platforms.map((platform) => {
                    const row = getRowData(platform);
                    return (
                      <tr key={platform} className="border-b border-white/5">
                        <td className="py-3 text-white">{platform}</td>
                        <td className="text-right py-3 text-slate-300">
                          {row ? row.followers.toLocaleString() : '\u2014'}
                        </td>
                        <td className="text-right py-3 text-slate-300">
                          {row ? row.posts : '\u2014'}
                        </td>
                        <td className="text-right py-3 text-slate-300">
                          {row ? `${row.engagement.toFixed(1)}%` : '\u2014'}
                        </td>
                        <td className="text-right py-3 text-slate-300">
                          {row ? row.reach.toLocaleString() : '\u2014'}
                        </td>
                        <td className="text-right py-3">
                          {row ? (
                            <span className={row.growth >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {row.growth >= 0 ? '+' : ''}{row.growth.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-300">{'\u2014'}</span>
                          )}
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
