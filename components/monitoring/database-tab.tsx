'use client';

/**
 * Database Tab Content
 * Database connection and query metrics
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { DatabaseMetrics } from './types';

interface DatabaseTabProps {
  metrics: DatabaseMetrics;
}

export function DatabaseTab({ metrics }: DatabaseTabProps) {
  const connectionPercentage = (metrics.connections / metrics.maxConnections) * 100;

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Database Metrics</CardTitle>
        <CardDescription>Connection pool and query performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-400">Connection Pool</span>
              <span className="text-sm text-white">
                {metrics.connections} / {metrics.maxConnections}
              </span>
            </div>
            <Progress value={connectionPercentage} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div>
              <p className="text-sm text-gray-400">Average Query Time</p>
              <p className="text-xl font-bold text-white">{metrics.queryTime}ms</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Database Size</p>
              <p className="text-xl font-bold text-white">{metrics.size}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Backup Status</p>
              <p className="text-xl font-bold text-green-400">{metrics.backupStatus}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Last Backup</p>
              <p className="text-xl font-bold text-white">2 hours ago</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
