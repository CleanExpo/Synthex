'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, BarChart3, RefreshCw } from '@/components/icons';
import { AuthorityFeatureGate } from '@/components/authority/AuthorityFeatureGate';
import { AuthorityScoreCard } from '@/components/authority/AuthorityScoreCard';
import { ClaimValidationBadge } from '@/components/authority/ClaimValidationBadge';
import { CitationList } from '@/components/authority/CitationList';
import { AuthoritySourcePanel } from '@/components/authority/AuthoritySourcePanel';
import type { AuthorityAnalysisResult } from '@/lib/authority/types';

interface Connector {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
}

export default function AuthorityPage() {
  const [activeTab, setActiveTab] = useState('analyze');
  const [content, setContent] = useState('');
  const [result, setResult] = useState<AuthorityAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [hasAddon, setHasAddon] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch connector status and subscription on mount
  useEffect(() => {
    const fetchConnectors = async () => {
      try {
        const res = await fetch('/api/authority/sources', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setConnectors(data.connectors ?? []);
        }
      } catch {
        // Non-blocking — connectors will show empty state
      }
    };

    const fetchSubscription = async () => {
      try {
        const res = await fetch('/api/billing/subscription', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setHasAddon(data.addons?.includes('authority') ?? false);
        }
      } catch {
        // Non-blocking — defaults to no addon
      }
    };

    fetchConnectors();
    fetchSubscription();
  }, []);

  const handleAnalyze = async () => {
    if (content.length < 50) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/authority/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content, orgId: 'default', deepValidation: hasAddon }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Analysis failed');
      }
      const data = await res.json();
      setResult(data);
      setActiveTab('citations');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyse content');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="h-7 w-7 text-violet-400" />
            Authority Engine
          </h1>
          <p className="text-gray-400 mt-1">Validate claims, generate citations, and connect authoritative sources</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border-white/10">
          <TabsTrigger value="analyze">Analyse Content</TabsTrigger>
          <TabsTrigger value="citations" disabled={!result}>Citations</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
        </TabsList>

        {/* Analyse Tab */}
        <TabsContent value="analyze" className="space-y-4 mt-4">
          <AuthorityFeatureGate hasAddon={hasAddon} featureName="Deep Claim Validation">
            <Card className="bg-surface-base/80 backdrop-blur-xl border border-violet-500/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="h-5 w-5 text-violet-400" />
                  Content Analyser
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Paste your content here to analyse claims and generate citations..."
                  className="w-full min-h-[200px] bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-violet-500/50 resize-y"
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {content.split(/\s+/).filter(Boolean).length} words
                  </span>
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || content.length < 50}
                    className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-violet-900 disabled:text-violet-400 text-white text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {isAnalyzing && <RefreshCw className="h-4 w-4 animate-spin" />}
                    {isAnalyzing ? 'Analysing...' : 'Analyse Authority'}
                  </button>
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
              </CardContent>
            </Card>
          </AuthorityFeatureGate>

          {/* Results inline when available */}
          {result && (
            <div className="space-y-4">
              <AuthorityScoreCard
                score={result.overallScore}
                claimsFound={result.claimsFound}
                claimsVerified={result.claimsVerified}
                claimsFailed={result.claimsFailed}
                sourceBreakdown={result.sourceBreakdown}
              />

              {result.claims.length > 0 && (
                <Card className="bg-surface-base/80 backdrop-blur-xl border border-violet-500/10">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">
                      Claim Validation ({result.claimsFound} claims)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {result.claims.map((claim, i) => (
                      <ClaimValidationBadge key={i} claim={claim} />
                    ))}
                  </CardContent>
                </Card>
              )}

              {result.recommendations.length > 0 && (
                <Card className="bg-surface-base/80 backdrop-blur-xl border border-violet-500/10">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {result.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                rec.priority === 'high'
                                  ? 'bg-red-500/20 text-red-400'
                                  : rec.priority === 'medium'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-slate-500/20 text-slate-400'
                              }`}>
                                {rec.priority}
                              </span>
                              <span className="text-xs text-slate-500 capitalize">{rec.type.replace(/_/g, ' ')}</span>
                            </div>
                            <p className="text-sm text-slate-300 line-clamp-2 mb-1 italic">&quot;{rec.claim}&quot;</p>
                            <p className="text-xs text-slate-400">{rec.suggestion}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Quick Feature Cards */}
          {!result && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: 'Claim Validation', desc: 'Verify statistical, factual, and regulatory claims against authoritative sources' },
                { title: 'Citation Generation', desc: 'Auto-generate formatted footnotes and inline citations from verified sources' },
                { title: 'Source Connectors', desc: 'Semantic Scholar, gov.au, industry registries, and authoritative web search' },
              ].map(({ title, desc }) => (
                <Card key={title} className="bg-surface-base/80 border border-violet-500/10">
                  <CardContent className="p-4">
                    <Shield className="h-8 w-8 text-violet-400 mb-3" />
                    <h3 className="text-white font-medium text-sm">{title}</h3>
                    <p className="text-gray-400 text-xs mt-1">{desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Citations Tab */}
        <TabsContent value="citations" className="mt-4">
          {result ? (
            <Card className="bg-surface-base/80 backdrop-blur-xl border border-violet-500/10">
              <CardHeader>
                <CardTitle className="text-white text-lg">
                  Generated Citations ({result.citations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CitationList citations={result.citations} />
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-surface-base/80 border border-violet-500/10">
              <CardContent className="p-12 text-center text-gray-400">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No citations yet</p>
                <p className="text-sm mt-1">Analyse content to generate formatted citations</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources" className="mt-4">
          <Card className="bg-surface-base/80 backdrop-blur-xl border border-violet-500/10">
            <CardHeader>
              <CardTitle className="text-white text-lg">
                Source Connectors
              </CardTitle>
            </CardHeader>
            <CardContent>
              {connectors.length > 0 ? (
                <AuthoritySourcePanel connectors={connectors} />
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">
                  No source connectors configured. Contact support to enable connectors.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
