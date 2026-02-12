'use client';

/**
 * Status Overview Cards
 * Top-level system status indicators
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Database, Zap, Shield } from '@/components/icons';
import { StatusBadge } from './config';
import type { MonitoringMetrics } from './types';

interface StatusOverviewProps {
  metrics: MonitoringMetrics;
}

export function StatusOverview({ metrics }: StatusOverviewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card variant="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center">
            <Server className="w-4 h-4 mr-2 text-cyan-400" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StatusBadge status={metrics.system.status} />
          <p className="text-xs text-gray-400 mt-2">Uptime: {metrics.system.uptime}</p>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center">
            <Database className="w-4 h-4 mr-2 text-blue-400" />
            Database
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">
            {metrics.database.connections}/{metrics.database.maxConnections}
          </p>
          <p className="text-xs text-gray-400 mt-1">Active Connections</p>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center">
            <Zap className="w-4 h-4 mr-2 text-yellow-400" />
            API Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">{metrics.api.latency}ms</p>
          <p className="text-xs text-gray-400 mt-1">Average Latency</p>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center">
            <Shield className="w-4 h-4 mr-2 text-green-400" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">{metrics.security.threats}</p>
          <p className="text-xs text-gray-400 mt-1">Active Threats</p>
        </CardContent>
      </Card>
    </div>
  );
}
