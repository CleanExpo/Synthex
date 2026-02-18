'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEOFeatureGate } from '@/components/seo';
import {
  usePageSpeed,
  type PageSpeedAnalysis,
  type PageSpeedHistoryEntry,
  type PerformanceTrendPoint,
} from '@/hooks/usePageSpeed';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  ArrowLeft,
  Zap,
  Loader2,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Search,
} from '@/components/icons';

// ============================================================================
// CWV Color Helpers
// ============================================================================

function getLcpColor(value: number): string {
  if (value <= 2.5) return 'text-green-400';
  if (value <= 4.0) return 'text-yellow-400';
  return 'text-red-400';
}

function getLcpBg(value: number): string {
  if (value <= 2.5) return 'bg-green-500/10 border-green-500/20';
  if (value <= 4.0) return 'bg-yellow-500/10 border-yellow-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function getClsColor(value: number): string {
  if (value <= 0.1) return 'text-green-400';
  if (value <= 0.25) return 'text-yellow-400';
  return 'text-red-400';
}

function getClsBg(value: number): string {
  if (value <= 0.1) return 'bg-green-500/10 border-green-500/20';
  if (value <= 0.25) return 'bg-yellow-500/10 border-yellow-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function getInpColor(value: number): string {
  if (value <= 200) return 'text-green-400';
  if (value <= 500) return 'text-yellow-400';
  return 'text-red-400';
}

function getInpBg(value: number): string {
  if (value <= 200) return 'bg-green-500/10 border-green-500/20';
  if (value <= 500) return 'bg-yellow-500/10 border-yellow-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreBg(score: number): string {
  if (score >= 90) return 'bg-green-500/10';
  if (score >= 50) return 'bg-yellow-500/10';
  return 'bg-red-500/10';
}

function getScoreRing(score: number): string {
  if (score >= 90) return 'border-green-500/40';
  if (score >= 50) return 'border-yellow-500/40';
  return 'border-red-500/40';
}

// ============================================================================
// Score Gauge Component
// ============================================================================

function ScoreGauge({ label, score }: { label: string; score: number }) {
  return (
    <div className={`p-4 rounded-xl ${getScoreBg(score)} border ${getScoreRing(score)} text-center`}>
      <div className={`text-3xl font-bold ${getScoreColor(score)} mb-1`}>
        {score}
      </div>
      <div className="text-xs text-gray-400 font-medium">{label}</div>
    </div>
  );
}

// ============================================================================
// CWV Metric Card
// ============================================================================

function CwvMetricCard({
  label,
  value,
  unit,
  colorFn,
  bgFn,
  source,
}: {
  label: string;
  value: number | null;
  unit: string;
  colorFn: (v: number) => string;
  bgFn: (v: number) => string;
  source: string;
}) {
  if (value === null) {
    return (
      <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-center">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className="text-lg font-bold text-gray-600">N/A</p>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-lg border text-center ${bgFn(value)}`}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorFn(value)}`}>
        {typeof value === 'number' && value < 1
          ? value.toFixed(3)
          : typeof value === 'number' && value < 10
            ? value.toFixed(2)
            : Math.round(value)}
        <span className="text-sm font-normal ml-1">{unit}</span>
      </p>
      <p className="text-[10px] text-gray-500 mt-1">{source}</p>
    </div>
  );
}

// ============================================================================
// Analysis Results Section
// ============================================================================

function AnalysisResults({ analysis }: { analysis: PageSpeedAnalysis }) {
  // Determine which CWV metrics to show (prefer field, fall back to lab)
  const cwvSource = analysis.fieldMetrics ? 'Field (CrUX)' : 'Lab (Lighthouse)';
  const lcpValue = analysis.fieldMetrics?.lcp ?? analysis.labMetrics.lcp;
  const clsValue = analysis.fieldMetrics?.cls ?? analysis.labMetrics.cls;
  const inpValue = analysis.fieldMetrics?.inp ?? null;

  return (
    <div className="space-y-6">
      {/* Demo indicator */}
      {analysis.isDemo && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Demo data shown. Set GOOGLE_PAGESPEED_API_KEY for live results.
        </div>
      )}

      {/* Score Gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreGauge label="Performance" score={analysis.scores.performance} />
        <ScoreGauge label="SEO" score={analysis.scores.seo} />
        <ScoreGauge label="Accessibility" score={analysis.scores.accessibility} />
        <ScoreGauge label="Best Practices" score={analysis.scores.bestPractices} />
      </div>

      {/* Core Web Vitals */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          Core Web Vitals
          <span className="text-xs text-gray-500">({cwvSource})</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CwvMetricCard
            label="LCP"
            value={lcpValue}
            unit="s"
            colorFn={getLcpColor}
            bgFn={getLcpBg}
            source={analysis.fieldMetrics?.lcp != null ? 'Field' : 'Lab'}
          />
          <CwvMetricCard
            label="CLS"
            value={clsValue}
            unit=""
            colorFn={getClsColor}
            bgFn={getClsBg}
            source={analysis.fieldMetrics?.cls != null ? 'Field' : 'Lab'}
          />
          <CwvMetricCard
            label="INP"
            value={inpValue}
            unit="ms"
            colorFn={getInpColor}
            bgFn={getInpBg}
            source={analysis.fieldMetrics?.inp != null ? 'Field' : 'Lab'}
          />
        </div>
      </div>

      {/* Opportunities */}
      {analysis.opportunities.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            Opportunities ({analysis.opportunities.length})
          </h3>
          <div className="space-y-2">
            {analysis.opportunities.map((opp, i) => (
              <div key={i} className="p-3 bg-white/5 rounded-lg flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{opp.title}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{opp.description}</p>
                </div>
                {opp.savings && (
                  <span className="flex-shrink-0 px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded text-xs font-medium border border-cyan-500/20">
                    {opp.savings}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diagnostics */}
      {analysis.diagnostics.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-400" />
            Diagnostics ({analysis.diagnostics.length})
          </h3>
          <div className="space-y-2">
            {analysis.diagnostics.map((diag, i) => (
              <div key={i} className="p-3 bg-white/5 rounded-lg flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{diag.title}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{diag.description}</p>
                </div>
                {diag.displayValue && (
                  <span className="flex-shrink-0 text-xs text-gray-400 font-mono whitespace-nowrap">
                    {diag.displayValue}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Performance Trends Chart
// ============================================================================

function PerformanceTrendsChart({ trends }: { trends: PerformanceTrendPoint[] }) {
  if (trends.length === 0) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No trend data yet</h3>
        <p className="text-gray-400">
          Run PageSpeed analyses to start tracking performance trends over time.
        </p>
      </div>
    );
  }

  const chartData = trends.map((point) => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    performance: point.avgPerformance,
    lcp: point.avgLcp,
    cls: point.avgCls,
  }));

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
          <YAxis yAxisId="score" stroke="#64748b" fontSize={12} domain={[0, 100]} />
          <YAxis yAxisId="seconds" orientation="right" stroke="#64748b" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(6, 182, 212, 0.2)',
              borderRadius: '8px',
              color: '#fff',
            }}
          />
          <Legend />
          <Line
            yAxisId="score"
            type="monotone"
            dataKey="performance"
            stroke="#06b6d4"
            strokeWidth={2}
            dot={{ fill: '#06b6d4', r: 3 }}
            name="Performance"
            connectNulls
          />
          <Line
            yAxisId="seconds"
            type="monotone"
            dataKey="lcp"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ fill: '#f59e0b', r: 3 }}
            name="LCP (s)"
            connectNulls
          />
          <Line
            yAxisId="seconds"
            type="monotone"
            dataKey="cls"
            stroke="#f43f5e"
            strokeWidth={2}
            dot={{ fill: '#f43f5e', r: 3 }}
            name="CLS"
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-cyan-500 rounded" /> Performance (0-100)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-amber-500 rounded" /> LCP (seconds)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-rose-500 rounded" /> CLS
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// History Table
// ============================================================================

function AnalysisHistoryTable({ history }: { history: PageSpeedHistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No analysis history</h3>
        <p className="text-gray-400">
          Run your first PageSpeed analysis to see results tracked here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-3 px-2 text-gray-400 font-medium">URL</th>
            <th className="text-left py-3 px-2 text-gray-400 font-medium">Date</th>
            <th className="text-right py-3 px-2 text-gray-400 font-medium">Performance</th>
            <th className="text-right py-3 px-2 text-gray-400 font-medium">LCP</th>
            <th className="text-right py-3 px-2 text-gray-400 font-medium">CLS</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry) => (
            <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="py-2.5 px-2 text-white font-mono text-xs truncate max-w-[250px]">
                {entry.url}
              </td>
              <td className="py-2.5 px-2 text-gray-300 text-xs whitespace-nowrap">
                {new Date(entry.date).toLocaleDateString()}
              </td>
              <td className="py-2.5 px-2 text-right">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getScoreBg(
                    entry.performanceScore
                  )} ${getScoreColor(entry.performanceScore)}`}
                >
                  {Math.round(entry.performanceScore)}
                </span>
              </td>
              <td className="py-2.5 px-2 text-right text-gray-300 text-xs">
                {entry.lcp != null ? `${entry.lcp.toFixed(2)}s` : 'N/A'}
              </td>
              <td className="py-2.5 px-2 text-right text-gray-300 text-xs">
                {entry.cls != null ? entry.cls.toFixed(3) : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function PageSpeedPage() {
  const [url, setUrl] = useState('');
  const [strategy, setStrategy] = useState<'mobile' | 'desktop'>('mobile');

  const {
    analysis,
    analysisLoading,
    analysisError,
    analyzeUrl,
    history,
    historyLoading,
    trends,
    trendsLoading,
  } = usePageSpeed();

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    analyzeUrl(normalizedUrl, strategy);
  };

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
            <Zap className="w-8 h-8 text-cyan-400" />
            PageSpeed Insights
          </h1>
          <p className="text-gray-400 mt-2">
            Analyze page performance, Core Web Vitals, and track improvements over time
          </p>
        </div>
      </div>

      <SEOFeatureGate
        feature="PageSpeed Insights"
        requiredPlan="professional"
        description="Access real-time page performance analysis with Lighthouse scores, Core Web Vitals, and historical trend tracking."
      >
        {/* Analyze URL Section */}
        <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
          <CardContent className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                Analyze URL
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Enter a URL to run PageSpeed Insights analysis with Lighthouse scores and Core Web Vitals
              </p>
            </div>

            <form onSubmit={handleAnalyze} className="space-y-3">
              <div className="flex gap-3">
                <Input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter URL to analyze (e.g., example.com)"
                  className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
                <Button
                  type="submit"
                  disabled={analysisLoading || !url.trim()}
                  className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white"
                >
                  {analysisLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  {analysisLoading ? 'Analyzing...' : 'Analyze'}
                </Button>
              </div>

              {/* Strategy Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 mr-2">Device:</span>
                {(['mobile', 'desktop'] as const).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStrategy(s)}
                    className={`text-xs capitalize ${
                      strategy === s
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                        : 'border-white/10 text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </form>

            {/* Error */}
            {analysisError && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {analysisError}
              </div>
            )}

            {/* Loading */}
            {analysisLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-400">
                    Running PageSpeed analysis... This may take up to 30 seconds.
                  </p>
                </div>
              </div>
            )}

            {/* Results */}
            {analysis && !analysisLoading && (
              <div className="mt-6">
                <AnalysisResults analysis={analysis} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Trends */}
        <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
          <CardContent className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                Performance Trends
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Track performance score, LCP, and CLS trends over the last 30 days
              </p>
            </div>
            {trendsLoading && trends.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
            ) : (
              <PerformanceTrendsChart trends={trends} />
            )}
          </CardContent>
        </Card>

        {/* Analysis History */}
        <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
          <CardContent className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Analysis History
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Past PageSpeed analyses and their results
              </p>
            </div>
            {historyLoading && history.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
            ) : (
              <AnalysisHistoryTable history={history} />
            )}
          </CardContent>
        </Card>
      </SEOFeatureGate>
    </div>
  );
}
