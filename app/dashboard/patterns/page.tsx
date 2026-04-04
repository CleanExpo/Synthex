'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnalyticsSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import { toast } from 'sonner';

import {
  type ViralPattern,
  filterPatterns,
  exportReport,
  PatternsHeader,
  AnalysisProgress,
  PatternsFilters,
  PatternsStats,
  EngagementTimelineChart,
  HookTypesChart,
  ViralPatternsList,
  PlatformRadarChart,
} from '@/components/patterns';

function getAuthToken(): string {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || localStorage.getItem('token') || '';
}

interface PatternRecord {
  id?: string;
  platform: string;
  pattern_type: string;
  pattern_data?: {
    content?: string;
    metrics?: { impressions?: number; engagement?: number; shares?: number };
    sentiment?: number;
    hook_type?: string;
    timestamp?: string;
  };
  engagement_score?: number;
  discovered_at: string;
}

function mapPatternRecord(record: PatternRecord, index: number): ViralPattern {
  const metrics = record.pattern_data?.metrics;
  const engagementScore = record.engagement_score ?? 0;
  return {
    id: index + 1,
    platform: record.platform,
    content: record.pattern_data?.content ?? '',
    type: record.pattern_type,
    engagement: metrics?.engagement ?? 0,
    impressions: metrics?.impressions ?? 0,
    shares: metrics?.shares ?? 0,
    hookType: record.pattern_data?.hook_type ?? 'Unknown',
    timing: record.pattern_data?.timestamp
      ? new Date(record.pattern_data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '',
    sentiment: record.pattern_data?.sentiment ?? 0,
    viralityScore: Math.round(engagementScore * 100),
    growthRate: '',
  };
}

export default function ViralPatternsPage() {
  const [patterns, setPatterns] = useState<ViralPattern[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPatterns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const params = new URLSearchParams({ timeRange: selectedTimeRange });
      if (selectedPlatform !== 'all') params.set('platform', selectedPlatform);
      const response = await fetch(`/api/patterns/analyze?${params}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Failed to load patterns');
      const data = await response.json();
      setPatterns((data.patterns as PatternRecord[]).map(mapPatternRecord));
    } catch {
      setError('Failed to load viral patterns');
    } finally {
      setIsLoading(false);
    }
  }, [selectedPlatform, selectedTimeRange]);

  useEffect(() => {
    loadPatterns();
  }, [loadPatterns]);

  const handleRetry = useCallback(() => {
    loadPatterns();
  }, [loadPatterns]);

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    try {
      const token = getAuthToken();
      // Trigger re-analysis via POST; progress is simulated while waiting for response
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => Math.min(prev + 15, 90));
      }, 300);
      const response = await fetch('/api/patterns/analyze', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ platform: selectedPlatform !== 'all' ? selectedPlatform : 'all', content: '', metrics: {} }),
      });
      clearInterval(progressInterval);
      setAnalysisProgress(100);
      if (response.ok) {
        toast.success('Analysis complete! Refreshing patterns.');
        await loadPatterns();
      } else {
        toast.error('Analysis failed. Please try again.');
      }
    } catch {
      toast.error('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  }, [selectedPlatform, loadPatterns]);

  const filteredPatterns = filterPatterns(patterns, selectedPlatform, searchQuery);

  const handleExportReport = useCallback(() => {
    exportReport(filteredPatterns, selectedPlatform, selectedTimeRange, searchQuery);
    toast.success('Report exported successfully!');
  }, [filteredPatterns, selectedPlatform, selectedTimeRange, searchQuery]);

  const handleAnalyzePattern = useCallback((pattern: ViralPattern) => {
    toast.success(`Analyzing "${pattern.content.substring(0, 30)}..." pattern`);
  }, []);

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6">
        <APIErrorCard
          title="Pattern Analysis Error"
          message={error}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PatternsHeader
        isAnalyzing={isAnalyzing}
        onAnalyze={handleAnalyze}
        onExport={handleExportReport}
      />

      {isAnalyzing && <AnalysisProgress progress={analysisProgress} />}

      <PatternsFilters
        platform={selectedPlatform}
        onPlatformChange={setSelectedPlatform}
        timeRange={selectedTimeRange}
        onTimeRangeChange={setSelectedTimeRange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <PatternsStats />

      <div className="grid gap-6 lg:grid-cols-2">
        <EngagementTimelineChart />
        <HookTypesChart />
      </div>

      <ViralPatternsList
        patterns={filteredPatterns}
        onAnalyzePattern={handleAnalyzePattern}
      />

      <PlatformRadarChart />
    </div>
  );
}
