'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEOFeatureGate } from '@/components/seo';
import {
  useTechnicalSEO,
  type CwvHistoryEntry,
  type MobileParityIssue,
  type RobotsTxtDirective,
} from '@/hooks/useTechnicalSEO';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  ArrowLeft,
  Settings,
  Activity,
  Monitor,
  FileSearch,
  AlertTriangle,
  CheckCircle,
  Search,
  Loader2,
  Shield,
  Bot,
  RefreshCw,
} from '@/components/icons';

// ============================================================================
// CWV History Chart
// ============================================================================

function CwvHistoryChart({ history }: { history: CwvHistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No CWV history yet</h3>
        <p className="text-gray-400 mb-6">
          Run your first SEO audit to start tracking Core Web Vitals over time.
        </p>
        <Link href="/dashboard/seo/audit">
          <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500">
            Run First Audit
          </Button>
        </Link>
      </div>
    );
  }

  const chartData = history.map((entry) => ({
    date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    lcp: entry.lcp ? Number(entry.lcp.toFixed(2)) : null,
    cls: entry.cls ? Number(entry.cls.toFixed(3)) : null,
    inp: entry.inp ? Math.round(entry.inp) : null,
    score: entry.overallScore,
  }));

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
          <YAxis stroke="#64748b" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(6, 182, 212, 0.2)',
              borderRadius: '8px',
              color: '#fff',
            }}
          />
          {/* LCP thresholds */}
          <ReferenceLine y={2.5} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.3} />
          <ReferenceLine y={4.0} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.3} />
          <Line
            type="monotone"
            dataKey="lcp"
            stroke="#06b6d4"
            strokeWidth={2}
            dot={{ fill: '#06b6d4', r: 3 }}
            name="LCP (s)"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="cls"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={{ fill: '#8b5cf6', r: 3 }}
            name="CLS"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="inp"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ fill: '#f59e0b', r: 3 }}
            name="INP (ms)"
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-cyan-500 rounded" /> LCP (seconds)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-violet-500 rounded" /> CLS
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-amber-500 rounded" /> INP (ms)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-green-500 rounded opacity-30" /> Good
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-red-500 rounded opacity-30" /> Poor
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Mobile Parity Section
// ============================================================================

function MobileParitySection({
  onCheck,
  result,
  loading,
  error,
}: {
  onCheck: (url: string) => void;
  result: ReturnType<typeof useTechnicalSEO>['mobileParityResult'];
  loading: boolean;
  error: string | null;
}) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      onCheck(normalizedUrl);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <Input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter URL to check (e.g., example.com)"
          className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
        />
        <Button
          type="submit"
          disabled={loading || !url.trim()}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Monitor className="w-4 h-4 mr-2" />}
          {loading ? 'Checking...' : 'Check Parity'}
        </Button>
      </form>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Match Scores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ScoreCard label="Content Match" value={result.contentMatch} />
            <ScoreCard label="Structure Match" value={result.structureMatch} />
          </div>

          {/* Performance Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 rounded-lg">
              <h4 className="text-sm font-medium text-gray-400 mb-2">Mobile Score</h4>
              <p className="text-2xl font-bold text-white">{result.mobileScore}/100</p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <h4 className="text-sm font-medium text-gray-400 mb-2">Desktop Score</h4>
              <p className="text-2xl font-bold text-white">{result.desktopScore}/100</p>
            </div>
          </div>

          {/* Issues */}
          {result.issues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-300">Issues Found ({result.issues.length})</h4>
              {result.issues.map((issue: MobileParityIssue, i: number) => (
                <div
                  key={i}
                  className="p-3 bg-white/5 rounded-lg flex items-start gap-3"
                >
                  <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    issue.severity === 'critical' ? 'text-red-400' :
                    issue.severity === 'major' ? 'text-yellow-400' : 'text-blue-400'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-white">{issue.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{issue.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-300">Recommendations</h4>
              {result.recommendations.map((rec: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  const color = value >= 90 ? 'text-green-400' : value >= 70 ? 'text-yellow-400' : 'text-red-400';
  const bg = value >= 90 ? 'bg-green-500/10' : value >= 70 ? 'bg-yellow-500/10' : 'bg-red-500/10';
  return (
    <div className={`p-4 ${bg} rounded-lg`}>
      <h4 className="text-sm font-medium text-gray-400 mb-1">{label}</h4>
      <p className={`text-2xl font-bold ${color}`}>{value}%</p>
    </div>
  );
}

// ============================================================================
// Robots.txt Validator Section
// ============================================================================

function RobotsTxtSection({
  onValidate,
  result,
  loading,
  error,
}: {
  onValidate: (url: string) => void;
  result: ReturnType<typeof useTechnicalSEO>['robotsTxtResult'];
  loading: boolean;
  error: string | null;
}) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      // Strip trailing path — API appends /robots.txt
      const baseUrl = normalizedUrl.replace(/\/robots\.txt\/?$/, '').replace(/\/+$/, '');
      onValidate(baseUrl);
    }
  };

  const AI_BOTS = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot'];

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <Input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter domain (e.g., example.com)"
          className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
        />
        <Button
          type="submit"
          disabled={loading || !url.trim()}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4 mr-2" />}
          {loading ? 'Validating...' : 'Validate'}
        </Button>
      </form>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Valid/Invalid Badge */}
          <div className="flex items-center gap-3">
            {result.valid ? (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm font-medium border border-green-500/20">
                <CheckCircle className="w-4 h-4" /> Valid
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-sm font-medium border border-red-500/20">
                <AlertTriangle className="w-4 h-4" /> Invalid
              </span>
            )}
            {result.sitemapUrls.length > 0 && (
              <span className="text-xs text-gray-500">
                {result.sitemapUrls.length} sitemap{result.sitemapUrls.length !== 1 ? 's' : ''} declared
              </span>
            )}
            {result.crawlDelay !== null && (
              <span className="text-xs text-gray-500">
                Crawl-delay: {result.crawlDelay}s
              </span>
            )}
          </div>

          {/* AI Bot Access */}
          <div className="p-4 bg-white/5 rounded-lg space-y-3">
            <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Bot className="w-4 h-4 text-cyan-400" />
              AI Bot Access
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {AI_BOTS.map((bot) => {
                const blocked = result.aiBotsBlocked.includes(bot);
                const allowed = result.aiBotsAllowed.includes(bot);
                return (
                  <div
                    key={bot}
                    className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                      blocked
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : allowed
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                    }`}
                  >
                    {blocked ? (
                      <Shield className="w-3.5 h-3.5" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    {bot}
                  </div>
                );
              })}
            </div>
            {result.aiBotsBlocked.length > 0 && (
              <p className="text-xs text-yellow-400">
                Blocking AI bots may reduce your content&apos;s visibility in AI-powered search results.
              </p>
            )}
          </div>

          {/* Directives */}
          {result.directives.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-300">Directives ({result.directives.length})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {result.directives.map((directive: RobotsTxtDirective, i: number) => (
                  <div key={i} className="p-3 bg-white/5 rounded-lg text-sm">
                    <span className="font-mono text-cyan-400">User-agent: {directive.userAgent}</span>
                    {directive.rules.map((rule, j) => (
                      <div key={j} className="ml-4 text-gray-400 font-mono text-xs">
                        {rule.type === 'allow' ? (
                          <span className="text-green-400">Allow:</span>
                        ) : (
                          <span className="text-red-400">Disallow:</span>
                        )}{' '}
                        {rule.path}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Issues */}
          {result.issues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-300">Issues ({result.issues.length})</h4>
              {result.issues.map((issue, i) => (
                <div key={i} className="p-3 bg-white/5 rounded-lg flex items-start gap-3">
                  <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    issue.severity === 'critical' ? 'text-red-400' :
                    issue.severity === 'major' ? 'text-yellow-400' :
                    issue.severity === 'minor' ? 'text-blue-400' : 'text-gray-400'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-white">{issue.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{issue.description}</p>
                    <p className="text-xs text-cyan-400 mt-1">{issue.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Raw Content */}
          {result.rawContent && (
            <details className="group">
              <summary className="text-sm font-medium text-gray-300 cursor-pointer hover:text-white">
                Raw robots.txt
              </summary>
              <pre className="mt-2 p-4 bg-black/30 rounded-lg text-xs text-gray-400 font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre">
                {result.rawContent}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function TechnicalSEOPage() {
  const {
    cwvHistory,
    cwvHistoryLoading,
    cwvHistoryError,
    refreshCwvHistory,
    mobileParityResult,
    mobileParityLoading,
    mobileParityError,
    checkMobileParity,
    robotsTxtResult,
    robotsTxtLoading,
    robotsTxtError,
    validateRobotsTxt,
  } = useTechnicalSEO();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <Link
            href="/dashboard/seo"
            className="text-sm text-gray-400 hover:text-cyan-400 flex items-center gap-1 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to SEO Tools
          </Link>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Settings className="w-8 h-8 text-cyan-400" />
            Technical SEO
          </h1>
          <p className="text-gray-400 mt-2">
            Monitor Core Web Vitals trends, check mobile/desktop parity, and validate robots.txt configuration.
          </p>
        </div>
      </div>

      <SEOFeatureGate
        feature="Technical SEO"
        requiredPlan="professional"
        description="Access Core Web Vitals monitoring, mobile parity analysis, and robots.txt validation tools."
      >
        {/* CWV History */}
        <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  Core Web Vitals History
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Track LCP, CLS, and INP trends from your SEO audits
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshCwvHistory}
                disabled={cwvHistoryLoading}
                className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${cwvHistoryLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            {cwvHistoryError ? (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {cwvHistoryError}
              </div>
            ) : cwvHistoryLoading && cwvHistory.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
            ) : (
              <CwvHistoryChart history={cwvHistory} />
            )}
          </CardContent>
        </Card>

        {/* Mobile Parity Checker */}
        <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
          <CardContent className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Monitor className="w-5 h-5 text-cyan-400" />
                Mobile Parity Checker
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Compare mobile vs desktop performance and content to ensure mobile-first indexing compliance
              </p>
            </div>
            <MobileParitySection
              onCheck={checkMobileParity}
              result={mobileParityResult}
              loading={mobileParityLoading}
              error={mobileParityError}
            />
          </CardContent>
        </Card>

        {/* Robots.txt Validator */}
        <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
          <CardContent className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <FileSearch className="w-5 h-5 text-cyan-400" />
                Robots.txt Validator
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Validate robots.txt directives and check AI bot access configuration
              </p>
            </div>
            <RobotsTxtSection
              onValidate={validateRobotsTxt}
              result={robotsTxtResult}
              loading={robotsTxtLoading}
              error={robotsTxtError}
            />
          </CardContent>
        </Card>
      </SEOFeatureGate>
    </div>
  );
}
