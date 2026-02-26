'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnalyticsSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import { toast } from 'sonner';

import {
  type ViralPattern,
  viralPatterns,
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

export default function ViralPatternsPage() {
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPatterns = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await new Promise(resolve => setTimeout(resolve, 600));
        setIsLoading(false);
      } catch {
        setError('Failed to load viral patterns');
        setIsLoading(false);
      }
    };
    loadPatterns();
  }, [selectedPlatform, selectedTimeRange]);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 600);
  }, []);

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    const interval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsAnalyzing(false);
          toast.success('Analysis complete! New patterns discovered.');
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  }, []);

  const filteredPatterns = filterPatterns(viralPatterns, selectedPlatform, searchQuery);

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
