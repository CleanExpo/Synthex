'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Globe, RefreshCw } from '@/components/icons';
import { GEOScoreCard } from './GEOScoreCard';
import { GEORecommendations } from './GEORecommendations';
import { PassageHighlighter } from './PassageHighlighter';

interface GEOAnalyzerProps {
  initialContent?: string;
}

export function GEOAnalyzer({ initialContent }: GEOAnalyzerProps) {
  const [content, setContent] = useState(initialContent || '');
  const [platform, setPlatform] = useState('all');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    if (content.length < 50) {
      setError('Content must be at least 50 characters');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/geo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contentText: content, platform }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Analysis failed');
      }

      setResult(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input */}
      <Card className="bg-white/[0.02] border-white/[0.08]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="h-5 w-5 text-cyan-400" />
            Content Analyzer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your content here for GEO analysis..."
            className="w-full h-48 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-500 p-4 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Platforms</option>
                <option value="google_aio">Google AI Overviews</option>
                <option value="chatgpt">ChatGPT</option>
                <option value="perplexity">Perplexity</option>
                <option value="bing_copilot">Bing Copilot</option>
              </select>
              <span className="text-xs text-gray-500">
                {content.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
            <Button onClick={analyze} disabled={loading || content.length < 50} className="bg-cyan-600 hover:bg-cyan-700">
              {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
              {loading ? 'Analyzing...' : 'Analyze'}
            </Button>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <GEOScoreCard score={result.score} />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <PassageHighlighter passages={result.citablePassages} />
            <GEORecommendations recommendations={result.recommendations} />
          </div>
        </div>
      )}
    </div>
  );
}
