'use client';

/**
 * Performance Tab Content
 * System performance metrics
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart } from '@/components/icons';
import type { SystemMetrics } from './types';

interface PerformanceTabProps {
  metrics: SystemMetrics;
}

export function PerformanceTab({ metrics }: PerformanceTabProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>System Performance</CardTitle>
        <CardDescription>Response time and request volume over 24 hours</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Response Time Chart Placeholder */}
          <div className="h-64 bg-white/5 rounded-lg flex items-center justify-center">
            <LineChart className="w-8 h-8 text-gray-500" />
            <span className="ml-2 text-gray-500">Response Time Chart</span>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-400">Avg Response Time</p>
              <p className="text-2xl font-bold text-white">{metrics.responseTime}ms</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Requests</p>
              <p className="text-2xl font-bold text-white">
                {metrics.requestCount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Error Rate</p>
              <p className="text-2xl font-bold text-white">{metrics.errorRate}%</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
