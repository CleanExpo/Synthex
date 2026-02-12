'use client';

/**
 * System Monitoring Page
 * Real-time system performance and health metrics
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw } from '@/components/icons';
import {
  MonitoringMetrics,
  StatusOverview,
  PerformanceTab,
  DatabaseTab,
  ApiTab,
  SecurityTab,
  ActiveUsers,
} from '@/components/monitoring';

const DEFAULT_METRICS: MonitoringMetrics = {
  system: {
    status: 'operational',
    uptime: '99.9%',
    responseTime: 245,
    errorRate: 0.1,
    requestCount: 15234,
    activeUsers: 87,
  },
  database: {
    connections: 12,
    maxConnections: 100,
    queryTime: 23,
    size: '245 MB',
    backupStatus: 'completed',
  },
  api: {
    health: 'healthy',
    latency: 120,
    throughput: 523,
    errorCount: 3,
    successRate: 99.7,
  },
  security: {
    threats: 0,
    blockedAttempts: 14,
    lastScan: '5 mins ago',
    sslStatus: 'valid',
  },
};

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<MonitoringMetrics>(DEFAULT_METRICS);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const refreshMetrics = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/monitoring/metrics');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setIsLoading(false);
      setLastUpdated(new Date());
    }
  };

  useEffect(() => {
    refreshMetrics();
    const interval = setInterval(refreshMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">System Monitoring</h1>
          <p className="text-gray-400">Real-time system performance and health metrics</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-400">Last Updated</p>
            <p className="text-sm text-white">{lastUpdated.toLocaleTimeString()}</p>
          </div>
          <Button
            onClick={refreshMetrics}
            disabled={isLoading}
            className="gradient-primary text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
      <StatusOverview metrics={metrics} />

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 bg-white/5">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <PerformanceTab metrics={metrics.system} />
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <DatabaseTab metrics={metrics.database} />
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <ApiTab metrics={metrics.api} />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <SecurityTab metrics={metrics.security} />
        </TabsContent>
      </Tabs>

      {/* Active Users */}
      <ActiveUsers activeUsers={metrics.system.activeUsers} />
    </div>
  );
}
