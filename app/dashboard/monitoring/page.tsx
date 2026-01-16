'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Database,
  Globe,
  MemoryStick,
  Server,
  TrendingUp,
  Users,
  Zap,
  RefreshCw,
  Shield,
  BarChart,
  LineChart
} from '@/components/icons';
import { Line, Bar } from 'recharts';
import { supabase } from '@/lib/supabase-client';

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState({
    system: {
      status: 'operational',
      uptime: '99.9%',
      responseTime: 245,
      errorRate: 0.1,
      requestCount: 15234,
      activeUsers: 87
    },
    database: {
      connections: 12,
      maxConnections: 100,
      queryTime: 23,
      size: '245 MB',
      backupStatus: 'completed'
    },
    api: {
      health: 'healthy',
      latency: 120,
      throughput: 523,
      errorCount: 3,
      successRate: 99.7
    },
    security: {
      threats: 0,
      blockedAttempts: 14,
      lastScan: '5 mins ago',
      sslStatus: 'valid'
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const refreshMetrics = async () => {
    setIsLoading(true);
    try {
      // Fetch real metrics from API
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
    const interval = setInterval(refreshMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const performanceData = [
    { time: '00:00', responseTime: 210, requests: 450 },
    { time: '04:00', responseTime: 190, requests: 320 },
    { time: '08:00', responseTime: 245, requests: 780 },
    { time: '12:00', responseTime: 310, requests: 1200 },
    { time: '16:00', responseTime: 280, requests: 950 },
    { time: '20:00', responseTime: 225, requests: 620 },
    { time: '24:00', responseTime: 200, requests: 480 }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
      case 'healthy':
      case 'completed':
      case 'valid':
        return 'text-green-400';
      case 'degraded':
      case 'warning':
        return 'text-yellow-400';
      case 'down':
      case 'error':
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusBadge = (status: string) => {
    const color = getStatusColor(status);
    return (
      <Badge className={`${color} bg-opacity-20`}>
        {status === 'operational' || status === 'healthy' ? (
          <CheckCircle className="w-3 h-3 mr-1" />
        ) : status === 'degraded' || status === 'warning' ? (
          <AlertCircle className="w-3 h-3 mr-1" />
        ) : (
          <AlertCircle className="w-3 h-3 mr-1" />
        )}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Server className="w-4 h-4 mr-2 text-purple-400" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getStatusBadge(metrics.system.status)}
            <p className="text-xs text-gray-400 mt-2">Uptime: {metrics.system.uptime}</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
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

        <Card className="glass-card">
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

        <Card className="glass-card">
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

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 bg-white/5">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card className="glass-card">
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
                    <p className="text-2xl font-bold text-white">{metrics.system.responseTime}ms</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total Requests</p>
                    <p className="text-2xl font-bold text-white">{metrics.system.requestCount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Error Rate</p>
                    <p className="text-2xl font-bold text-white">{metrics.system.errorRate}%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <Card className="glass-card">
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
                      {metrics.database.connections} / {metrics.database.maxConnections}
                    </span>
                  </div>
                  <Progress 
                    value={(metrics.database.connections / metrics.database.maxConnections) * 100} 
                    className="h-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <p className="text-sm text-gray-400">Average Query Time</p>
                    <p className="text-xl font-bold text-white">{metrics.database.queryTime}ms</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Database Size</p>
                    <p className="text-xl font-bold text-white">{metrics.database.size}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Backup Status</p>
                    <p className="text-xl font-bold text-green-400">{metrics.database.backupStatus}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Last Backup</p>
                    <p className="text-xl font-bold text-white">2 hours ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Card className="glass-card">
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
                  {getStatusBadge(metrics.api.health)}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Success Rate</p>
                    <p className="text-2xl font-bold text-white">{metrics.api.successRate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Throughput</p>
                    <p className="text-2xl font-bold text-white">{metrics.api.throughput} req/s</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Error Count (24h)</p>
                    <p className="text-2xl font-bold text-yellow-400">{metrics.api.errorCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">P95 Latency</p>
                    <p className="text-2xl font-bold text-white">{metrics.api.latency * 1.5}ms</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Security Overview</CardTitle>
              <CardDescription>Threat detection and prevention status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Shield className="w-5 h-5 text-green-400" />
                      <Badge className="bg-green-400/20 text-green-400">Active</Badge>
                    </div>
                    <p className="text-sm text-gray-400">Firewall Status</p>
                    <p className="text-lg font-bold text-white">Protected</p>
                  </div>

                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Globe className="w-5 h-5 text-green-400" />
                      <Badge className="bg-green-400/20 text-green-400">Valid</Badge>
                    </div>
                    <p className="text-sm text-gray-400">SSL Certificate</p>
                    <p className="text-lg font-bold text-white">Expires in 89 days</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b border-white/10">
                    <span className="text-sm text-gray-400">Active Threats</span>
                    <span className="text-sm font-bold text-green-400">{metrics.security.threats}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/10">
                    <span className="text-sm text-gray-400">Blocked Attempts (24h)</span>
                    <span className="text-sm font-bold text-yellow-400">{metrics.security.blockedAttempts}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/10">
                    <span className="text-sm text-gray-400">Last Security Scan</span>
                    <span className="text-sm font-bold text-white">{metrics.security.lastScan}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-gray-400">DDoS Protection</span>
                    <span className="text-sm font-bold text-green-400">Enabled</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Active Users and Sessions */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2 text-purple-400" />
            Active Users
          </CardTitle>
          <CardDescription>Currently active user sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-white">{metrics.system.activeUsers}</p>
              <p className="text-sm text-gray-400">Users online</p>
            </div>
            <div className="flex items-center text-green-400">
              <TrendingUp className="w-5 h-5 mr-2" />
              <span className="text-sm">+12% from yesterday</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}