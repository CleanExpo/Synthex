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
import { DesignAuditCard } from '@/components/authority/DesignAuditCard';
import { CROScoreCard } from '@/components/authority/CROScoreCard';
import { LLMCitationFitnessCard } from '@/components/authority/LLMCitationFitnessCard';
import type { AuthorityAnalysisResult } from '@/lib/authority/types';
import type { DesignAuditResult } from '@/lib/authority/design-audit/types';

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

  // Design audit state
  const [designAuditUrl, setDesignAuditUrl] = useState('');
  const [designAuditContent, setDesignAuditContent] = useState('');
  const [designAuditMode, setDesignAuditMode] = useState<'url' | 'content'>('url');
  const [designAuditResult, setDesignAuditResult] = useState<DesignAuditResult | null>(null);
  const [isAuditRunning, setIsAuditRunning] = useState(false);

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

  const handleDesignAudit = async () => {
    setIsAuditRunning(true);
    try {
      const body =
        designAuditMode === 'url'
          ? { url: designAuditUrl }
          : { content: designAuditContent };
      const res = await fetch('/api/authority/design-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setDesignAuditResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAuditRunning(false);
    }
  };

  const isDesignAuditDisabled =
    isAuditRunning ||
    (designAuditMode === 'url' ? !designAuditUrl : designAuditContent.length < 50);

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
          <TabsTrigger value="design-audit">Design Audit</TabsTrigger>
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

        {/* Design Audit Tab */}
        <TabsContent value="design-audit" className="space-y-4 mt-4">
          <AuthorityFeatureGate hasAddon={hasAddon} featureName="Design Audit">
            <Card className="bg-surface-base/80 backdrop-blur-xl border border-violet-500/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-violet-400" />
                  Design Audit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mode toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setDesignAuditMode('url')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      designAuditMode === 'url'
                        ? 'bg-violet-600 text-white'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    URL
                  </button>
                  <button
                    onClick={() => setDesignAuditMode('content')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      designAuditMode === 'content'
                        ? 'bg-violet-600 text-white'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    Paste Content
                  </button>
                </div>

                {designAuditMode === 'url' ? (
                  <input
                    type="url"
                    value={designAuditUrl}
                    onChange={e => setDesignAuditUrl(e.target.value)}
                    placeholder="https://example.com/page-to-audit"
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                  />
                ) : (
                  <textarea
                    value={designAuditContent}
                    onChange={e => setDesignAuditContent(e.target.value)}
                    placeholder="Paste your page content or HTML here..."
                    className="w-full min-h-[180px] bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-violet-500/50 resize-y"
                  />
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleDesignAudit}
                    disabled={isDesignAuditDisabled}
                    className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-violet-900 disabled:text-violet-400 text-white text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {isAuditRunning && <RefreshCw className="h-4 w-4 animate-spin" />}
                    {isAuditRunning ? 'Running Audit...' : 'Run Design Audit'}
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Design audit results */}
            {designAuditResult && (
              <div className="space-y-4">
                {/* Overall score banner */}
                <Card className="bg-white/5 border-violet-500/10 backdrop-blur-sm">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Overall Design Score</p>
                      <p className="text-3xl font-bold text-white mt-0.5">{designAuditResult.overallScore}</p>
                    </div>
                    <div className="text-right text-xs text-slate-500 space-y-1">
                      <p>Design: {designAuditResult.designQuality.total}</p>
                      <p>CRO: {designAuditResult.croReadiness.total}</p>
                      <p>LLM Fitness: {designAuditResult.llmCitationFitness.total}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Score cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <DesignAuditCard
                    score={designAuditResult.designQuality}
                    issues={designAuditResult.issues}
                  />
                  <CROScoreCard
                    score={designAuditResult.croReadiness}
                    issues={designAuditResult.issues}
                  />
                  <LLMCitationFitnessCard
                    score={designAuditResult.llmCitationFitness}
                    issues={designAuditResult.issues}
                  />
                </div>

                {/* Recommendations */}
                {designAuditResult.recommendations.length > 0 && (
                  <Card className="bg-surface-base/80 backdrop-blur-xl border border-violet-500/10">
                    <CardHeader>
                      <CardTitle className="text-white text-lg">
                        Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {designAuditResult.recommendations.map((rec, i) => (
                          <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
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
                              <span className="text-xs text-slate-500 capitalize">{rec.category}</span>
                            </div>
                            <p className="text-sm font-medium text-white mb-1">{rec.title}</p>
                            <p className="text-xs text-slate-400 mb-1">{rec.description}</p>
                            <p className="text-xs text-emerald-400">{rec.impact}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Issues list */}
                {designAuditResult.issues.length > 0 && (
                  <Card className="bg-surface-base/80 backdrop-blur-xl border border-violet-500/10">
                    <CardHeader>
                      <CardTitle className="text-white text-lg">
                        Issues ({designAuditResult.issues.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {designAuditResult.issues.map((issue, i) => (
                          <div key={i} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                            <span className={`mt-0.5 text-xs font-medium px-1.5 py-0.5 rounded ${
                              issue.type === 'error'
                                ? 'bg-red-500/20 text-red-400'
                                : issue.type === 'warning'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {issue.type}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-300">{issue.message}</p>
                              {issue.element && (
                                <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">{issue.element}</p>
                              )}
                            </div>
                            <span className="text-xs text-slate-600 capitalize">{issue.category}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </AuthorityFeatureGate>
        </TabsContent>
      </Tabs>
    </div>
  );
}
