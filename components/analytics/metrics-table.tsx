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

const platforms = ['Twitter', 'LinkedIn', 'Instagram', 'TikTok', 'Facebook'];

export function MetricsTable() {
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
                  {platforms.map((platform) => (
                    <tr key={platform} className="border-b border-white/5">
                      <td className="py-3 text-white">{platform}</td>
                      <td className="text-right py-3 text-slate-300">
                        {Math.floor(Math.random() * 50000 + 10000).toLocaleString()}
                      </td>
                      <td className="text-right py-3 text-slate-300">
                        {Math.floor(Math.random() * 100 + 20)}
                      </td>
                      <td className="text-right py-3 text-slate-300">
                        {(Math.random() * 10 + 2).toFixed(1)}%
                      </td>
                      <td className="text-right py-3 text-slate-300">
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
  );
}
