'use client';

/**
 * Psychology Analysis Page
 * AI-powered content psychology analysis
 */

import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
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
      toast.error('Failed to analyze content');

      // Show demo result for development
      setResult({
        overallScore: 78,
        principles: [
          { name: 'Social Proof', score: 85, description: 'Leverages social validation', recommendation: 'Add specific numbers or testimonials' },
          { name: 'Scarcity', score: 60, description: 'Creates urgency', recommendation: 'Emphasize limited availability' },
          { name: 'Reciprocity', score: 72, description: 'Offers value first', recommendation: 'Lead with a free resource or insight' },
          { name: 'Authority', score: 80, description: 'Establishes credibility', recommendation: 'Include credentials or data sources' },
        ],
        emotionalTone: {
          primary: 'Confident',
          secondary: ['Inspiring', 'Professional'],
          score: 75,
        },
        readability: {
          score: 82,
          level: 'Easy to read',
          wordCount: content.split(/\s+/).length,
          avgSentenceLength: 15,
        },
        persuasionMetrics: {
          clarity: 85,
          urgency: 65,
          credibility: 78,
          engagement: 72,
        },
        recommendations: [
          'Add a clear call-to-action to improve conversion',
          'Include specific numbers or statistics for credibility',
          'Create urgency with time-limited offers',
          'Use more power words to increase emotional impact',
        ],
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" />

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
