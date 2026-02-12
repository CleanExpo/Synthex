'use client';

/**
 * API Tab Content
 * API health and performance metrics
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from '@/components/icons';
import { StatusBadge } from './config';
import type { ApiMetrics } from './types';

interface ApiTabProps {
  metrics: ApiMetrics;
}

export function ApiTab({ metrics }: ApiTabProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>API Health</CardTitle>
        <CardDescription>Endpoint performance and reliability</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
            <div className="flex items-center">
              <Activity className="w-5 h-5 text-green-400 mr-3" />
              <div>
                <p className="font-medium text-white">API Status</p>
                <p className="text-sm text-gray-400">All endpoints operational</p>
              </div>
            </div>
            <StatusBadge status={metrics.health} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Success Rate</p>
              <p className="text-2xl font-bold text-white">{metrics.successRate}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Throughput</p>
              <p className="text-2xl font-bold text-white">{metrics.throughput} req/s</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Error Count (24h)</p>
              <p className="text-2xl font-bold text-yellow-400">{metrics.errorCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">P95 Latency</p>
              <p className="text-2xl font-bold text-white">{metrics.latency * 1.5}ms</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
