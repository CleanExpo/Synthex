'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Globe,
  Search,
  Eye,
  Target,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Shield,
  Database,
  Zap,
} from '@/components/icons';
import { GEOFeatureGate } from '@/components/geo/GEOFeatureGate';
import type { GEOAnalysisResult, GEOScore, EntityAnalysisResult } from '@/lib/geo/types';

/** The API response extends GEOAnalysisResult with a persisted record id. */
type GEOAnalysisResponse = GEOAnalysisResult & { id: string };

export default function GEOPage() {
  const [content, setContent] = useState('');
  const [platform, setPlatform] = useState('all');
  const [result, setResult] = useState<GEOAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('analyze');

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
      setActiveTab('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze');
    } finally {
      setLoading(false);
    }
  };

  const scoreDimensions = [
    { key: 'citability', label: 'Citability', icon: Eye, weight: '25%', color: 'text-cyan-400' },
    { key: 'structure', label: 'Structure', icon: Database, weight: '20%', color: 'text-purple-400' },
    { key: 'multiModal', label: 'Multi-Modal', icon: Globe, weight: '15%', color: 'text-amber-400' },
    { key: 'authority', label: 'Authority', icon: Shield, weight: '20%', color: 'text-emerald-400' },
    { key: 'technical', label: 'Technical', icon: TrendingUp, weight: '20%', color: 'text-rose-400' },
    { key: 'entityCoherence', label: 'Entities', icon: Target, weight: '(diagnostic)', color: 'text-violet-400' },
  ] as const;

  const getTier = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'bg-emerald-500/20 text-emerald-400' };
    if (score >= 60) return { label: 'Good', color: 'bg-cyan-500/20 text-cyan-400' };
    if (score >= 40) return { label: 'Needs Work', color: 'bg-amber-500/20 text-amber-400' };
    return { label: 'Poor', color: 'bg-red-500/20 text-red-400' };
  };

  return (
    <GEOFeatureGate
      feature="GEO Analysis"
      requiredPlan="professional"
      description="Unlock Generative Engine Optimization to score content citability across Google AI Overviews, ChatGPT, Perplexity, and Bing Copilot."
      benefits={[
        'Content citability scoring across 5 dimensions',
        'Citable passage extraction (134-167 word blocks)',
        'Platform-specific optimization for 4 AI engines',
      ]}
    >
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Globe className="h-7 w-7 text-cyan-400" />
            GEO Analysis
          </h1>
          <p className="text-gray-400 mt-1">Generative Engine Optimization — optimize content for AI search engines</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border-white/10">
          <TabsTrigger value="analyze">Analyze Content</TabsTrigger>
          <TabsTrigger value="results" disabled={!result}>Results</TabsTrigger>
          <TabsTrigger value="entities" disabled={!result}>Entities</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="analyze" className="space-y-4 mt-4">
          <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
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
                placeholder="Paste your content here for GEO analysis. Minimum 50 characters. The analyzer will score your content across 5 dimensions: Citability, Structure, Multi-Modal, Authority, and Technical..."
                className="w-full h-64 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-500 p-4 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
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
                  <span className="text-sm text-gray-500">
                    {content.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
                <Button onClick={analyze} disabled={loading || content.length < 50} className="bg-cyan-600 hover:bg-cyan-700">
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                  {loading ? 'Analyzing...' : 'Analyze Content'}
                </Button>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </CardContent>
          </Card>

          {/* Quick Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Eye, title: 'Passage Optimization', desc: '134-167 word citable blocks for AI extraction' },
              { icon: Target, title: 'Platform Scoring', desc: 'Google AIO, ChatGPT, Perplexity, Bing Copilot' },
              { icon: Zap, title: 'Schema Enhancement', desc: 'Dataset, SpeakableSpec, ClaimReview schemas' },
            ].map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="bg-surface-base/80 border border-cyan-500/10">
                <CardContent className="p-4">
                  <Icon className="h-8 w-8 text-cyan-400 mb-3" />
                  <h3 className="text-white font-medium text-sm">{title}</h3>
                  <p className="text-gray-400 text-xs mt-1">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="results" className="mt-4">
          {result && (
            <div className="space-y-6">
              {/* Score Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="bg-surface-base/80 border border-cyan-500/10">
                  <CardContent className="p-6 text-center">
                    <div className="text-6xl font-bold text-white mb-2">{result.score.overall}</div>
                    <Badge className={getTier(result.score.overall).color}>
                      {getTier(result.score.overall).label}
                    </Badge>
                    <p className="text-gray-400 text-sm mt-2">Overall GEO Score</p>
                  </CardContent>
                </Card>
                <div className="lg:col-span-2">
                  <Card className="bg-surface-base/80 border border-cyan-500/10 h-full">
                    <CardContent className="p-6 space-y-3">
                      {scoreDimensions.map(({ key, label, icon: Icon, weight, color }) => (
                        <div key={key} className="flex items-center gap-3">
                          <Icon className={`h-4 w-4 ${color} shrink-0`} />
                          <span className="text-sm text-gray-300 w-24">{label}</span>
                          <div className="flex-1 bg-white/5 rounded-full h-2">
                            <div
                              className="bg-cyan-500 h-2 rounded-full transition-all"
                              style={{ width: `${result.score[key as keyof GEOScore]}%` }}
                            />
                          </div>
                          <span className="text-sm text-white font-medium w-10 text-right">{result.score[key as keyof GEOScore]}</span>
                          <span className="text-xs text-gray-500 w-8">({weight})</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Passages */}
              {result.citablePassages?.length > 0 && (
                <Card className="bg-surface-base/80 border border-cyan-500/10">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">
                      Citable Passages ({result.citablePassages.filter((p) => p.isOptimalLength).length}/{result.citablePassages.length} optimal)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {result.citablePassages.slice(0, 8).map((p, i) => (
                        <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex gap-2">
                              {p.isOptimalLength && <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">Optimal</Badge>}
                              {p.answerFirst && <Badge className="bg-cyan-500/20 text-cyan-400 text-xs">Answer-First</Badge>}
                              {p.hasCitation && <Badge className="bg-purple-500/20 text-purple-400 text-xs">Cited</Badge>}
                            </div>
                            <span className="text-sm text-gray-400">{p.wordCount}w — Score: {p.score}</span>
                          </div>
                          <p className="text-sm text-gray-300 line-clamp-2">{p.text}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              {result.recommendations?.length > 0 && (
                <Card className="bg-surface-base/80 border border-cyan-500/10">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {result.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                          <Zap className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-white font-medium">{rec.title}</span>
                              <Badge className={`text-xs ${rec.priority === 'critical' ? 'bg-red-500/20 text-red-400' : rec.priority === 'high' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                {rec.priority}
                              </Badge>
                              <Badge className="bg-white/5 text-gray-400 text-xs">+{rec.impact}pts</Badge>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{rec.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="bg-surface-base/80 border border-cyan-500/10">
            <CardContent className="p-12 text-center text-gray-400">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Analysis history coming soon</p>
              <p className="text-sm mt-1">Track your GEO score improvements over time</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </GEOFeatureGate>
  );
}
