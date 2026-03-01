'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, RefreshCw, Download } from '@/components/icons';
import { toast } from 'sonner';

import { OverviewMetrics } from './OverviewMetrics';
import { EngagementCharts } from './EngagementCharts';
import { PlatformPerformance } from './PlatformPerformance';
import { ContentAndTrends } from './ContentAndTrends';
import { Demographics } from './Demographics';
import { getDefaultAnalyticsData } from './constants';
import type { AnalyticsData } from './types';

export function RealTimeAnalytics() {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isRealTime, setIsRealTime] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>(getDefaultAnalyticsData());

  // Simulate real-time updates
  useEffect(() => {
    if (!isRealTime) return;

    const interval = setInterval(() => {
      setAnalyticsData(prev => ({
        ...prev,
        overview: {
          ...prev.overview,
          totalReach: prev.overview.totalReach + Math.floor(Math.random() * 100),
          totalEngagement: prev.overview.totalEngagement + Math.floor(Math.random() * 10),
          engagementRate: +(Math.random() * 2 + 6).toFixed(2)
        }
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [isRealTime]);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setAnalyticsData(prev => ({
        ...prev,
        overview: {
          ...prev.overview,
          totalReach: prev.overview.totalReach + Math.floor(Math.random() * 1000),
          totalEngagement: prev.overview.totalEngagement + Math.floor(Math.random() * 100)
        }
      }));
      toast.success('Analytics data refreshed');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      setIsLoading(false);
    }
  };

  const exportData = () => {
    const dataStr = JSON.stringify(analyticsData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Analytics data exported');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold gradient-text">Real-Time Analytics</h2>
          <p className="text-gray-400 mt-2">Monitor your social media performance in real-time</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="twitter">Twitter</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={isRealTime ? 'default' : 'outline'}
            onClick={() => setIsRealTime(!isRealTime)}
            className={isRealTime ? 'gradient-primary' : ''}
          >
            <Activity className="w-4 h-4 mr-2" />
            {isRealTime ? 'Live' : 'Paused'}
          </Button>
          <Button variant="outline" onClick={refreshData} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportData}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <OverviewMetrics overview={analyticsData.overview} />
      <EngagementCharts performance={analyticsData.performance} platforms={analyticsData.platforms} />
      <PlatformPerformance platforms={analyticsData.platforms} />
      <ContentAndTrends topContent={analyticsData.topContent} trends={analyticsData.trends} />
      <Demographics demographics={analyticsData.demographics} />
    </div>
  );
}

export default RealTimeAnalytics;
