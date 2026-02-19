'use client';

/**
 * Psychology Analysis Page
 * AI-powered content psychology analysis
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  AnalysisResult,
  ContentInput,
  OverallScore,
  PrinciplesCard,
  PersuasionMetricsCard,
  RecommendationsCard,
  EmptyState,
} from '@/components/psychology';

export default function PsychologyPage() {
  const [content, setContent] = useState('');
  const [platform, setPlatform] = useState('twitter');
  const [contentType, setContentType] = useState('post');
  const [targetAudience, setTargetAudience] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async () => {
    if (!content.trim()) {
      toast.error('Please enter content to analyze');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/psychology/analyze', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          platform,
          contentType,
          targetAudience: targetAudience || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();

      if (data.success && data.data?.analysis) {
        setResult(data.data.analysis);
        toast.success('Analysis complete!');
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze content. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Psychology Analysis</h1>
          <p className="text-gray-400">Analyze content for psychological persuasion effectiveness</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-6">
          <ContentInput
            content={content}
            platform={platform}
            contentType={contentType}
            targetAudience={targetAudience}
            isAnalyzing={isAnalyzing}
            onContentChange={setContent}
            onPlatformChange={setPlatform}
            onContentTypeChange={setContentType}
            onTargetAudienceChange={setTargetAudience}
            onAnalyze={handleAnalyze}
          />
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          {result ? (
            <>
              <OverallScore score={result.overallScore} />
              <PrinciplesCard principles={result.principles} />
              <PersuasionMetricsCard metrics={result.persuasionMetrics} />
              <RecommendationsCard recommendations={result.recommendations} />
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}
