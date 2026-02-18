'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEOFeatureGate } from '@/components/seo';
import {
  useGeoReadiness,
  type GeoReadinessResult,
  type GeoAnalysisHistoryItem,
  type GeoScoreTrend,
} from '@/hooks/useGeoReadiness';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  ArrowLeft,
  Globe,
  Loader2,
  Eye,
  Database,
  Shield,
  TrendingUp,
  Zap,
  CheckCircle,
  XCircle,
  Activity,
  FileText,
} from '@/components/icons';

// ============================================================================
// Constants
// ============================================================================

const PLATFORMS = [
  { value: 'all', label: 'All Platforms' },
  { value: 'google_aio', label: 'Google AIO' },
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'perplexity', label: 'Perplexity' },
  { value: 'bing_copilot', label: 'Bing Copilot' },
];

const DIMENSION_CONFIG = [
  { key: 'citability', label: 'Citability', weight: '25%', color: 'cyan', icon: Eye },
  { key: 'structure', label: 'Structure', weight: '20%', color: 'purple', icon: Database },
  { key: 'multiModal', label: 'Multi-Modal', weight: '15%', color: 'amber', icon: Globe },
  { key: 'authority', label: 'Authority', weight: '20%', color: 'emerald', icon: Shield },
  { key: 'technical', label: 'Technical', weight: '20%', color: 'rose', icon: Zap },
];

// ============================================================================
// Helpers
// ============================================================================

function getTierBadge(tier: string): { label: string; className: string } {
  switch (tier) {
    case 'ready':
      return { label: 'Ready', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    case 'almost':
      return { label: 'Almost Ready', className: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' };
    case 'needs-work':
      return { label: 'Needs Work', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    default:
      return { label: 'Not Ready', className: 'bg-red-500/20 text-red-400 border-red-500/30' };
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-cyan-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500/10';
  if (score >= 60) return 'bg-cyan-500/10';
  if (score >= 40) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}

function getScoreRing(score: number): string {
  if (score >= 80) return 'border-emerald-500/40';
  if (score >= 60) return 'border-cyan-500/40';
  if (score >= 40) return 'border-amber-500/40';
  return 'border-red-500/40';
}

function getBarColor(colorName: string): string {
  const colors: Record<string, string> = {
    cyan: 'bg-cyan-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
  };
  return colors[colorName] || 'bg-gray-500';
}

// ============================================================================
// Tab Components
// ============================================================================

function ReadinessCheckTab({
  onAnalyze,
  loading,
  error,
  result,
}: {
  onAnalyze: (content: string, url?: string, platform?: string) => void;
  loading: boolean;
  error: string | null;
  result: GeoReadinessResult | null;
}) {
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('all');

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim().length < 50) return;
    onAnalyze(content, url || undefined, platform);
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
        <CardContent className="p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              Check GEO Readiness
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Paste your content to assess its readiness for AI search engines
            </p>
          </div>

          <form onSubmit={handleAnalyze} className="space-y-4">
            <div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your content here (minimum 50 characters)..."
                className="w-full h-48 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/40 resize-none"
              />
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>{wordCount} words</span>
                <span>{content.length} characters</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Content URL (optional)
                </label>
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Target Platform
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-cyan-500/40"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value} className="bg-slate-900">
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || content.trim().length < 50}
              className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 mr-2" />
                  Check Readiness
                </>
              )}
            </Button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && !loading && (
        <ReadinessResults result={result} />
      )}
    </div>
  );
}

function ReadinessResults({ result }: { result: GeoReadinessResult }) {
  const tierBadge = getTierBadge(result.readinessTier);

  return (
    <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
      <CardContent className="p-6 space-y-6">
        {/* Overall Score */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`w-20 h-20 rounded-xl ${getScoreBg(result.score.overall)} border ${getScoreRing(result.score.overall)} flex items-center justify-center`}
            >
              <span className={`text-3xl font-bold ${getScoreColor(result.score.overall)}`}>
                {result.score.overall}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">Overall Score</h3>
              <span className={`inline-block mt-1 px-3 py-1 text-sm font-medium rounded-full border ${tierBadge.className}`}>
                {tierBadge.label}
              </span>
            </div>
          </div>
        </div>

        {/* Dimension Scores */}
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-3">Dimension Scores</h4>
          <div className="space-y-3">
            {DIMENSION_CONFIG.map((dim) => {
              const score = result.score[dim.key as keyof typeof result.score] || 0;
              const Icon = dim.icon;
              return (
                <div key={dim.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-300">
                      <Icon className="w-4 h-4 text-gray-500" />
                      {dim.label}
                      <span className="text-gray-600">({dim.weight})</span>
                    </span>
                    <span className={getScoreColor(score)}>{score}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getBarColor(dim.color)} transition-all duration-500`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Platform Readiness */}
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-3">Platform Readiness</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(result.platformReadiness).map(([platform, ready]) => (
              <div
                key={platform}
                className={`p-3 rounded-lg border ${
                  ready
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : 'bg-red-500/10 border-red-500/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  {ready ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className={`text-sm font-medium ${ready ? 'text-emerald-400' : 'text-red-400'}`}>
                    {platform.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Readiness Summaries */}
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-3">Assessment Summary</h4>
          <div className="space-y-2">
            {Object.entries(result.readinessSummaries).map(([key, summary]) => (
              <div key={key} className="p-3 bg-white/5 rounded-lg">
                <p className="text-sm text-gray-300">{summary}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PassagesTab({ result }: { result: GeoReadinessResult | null }) {
  const [showOptimalOnly, setShowOptimalOnly] = useState(false);

  if (!result || result.citablePassages.length === 0) {
    return (
      <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
        <CardContent className="p-6">
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No passages yet</h3>
            <p className="text-gray-400">
              Run a readiness check to see citable passages extracted from your content.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const passages = showOptimalOnly
    ? result.citablePassages.filter((p) => p.isOptimalLength)
    : result.citablePassages;

  return (
    <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Citable Passages
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {passages.length} passage{passages.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOptimalOnly(!showOptimalOnly)}
            className={`text-xs ${
              showOptimalOnly
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                : 'border-white/10 text-gray-400 hover:bg-white/5'
            }`}
          >
            {showOptimalOnly ? 'Show All' : 'Optimal Only'}
          </Button>
        </div>

        <div className="space-y-4">
          {passages.map((passage, idx) => (
            <div key={idx} className="p-4 bg-white/5 rounded-lg border border-white/10">
              <p className="text-gray-300 text-sm line-clamp-3 mb-3">{passage.text}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-1 text-xs font-medium rounded ${getScoreBg(passage.score)} ${getScoreColor(passage.score)}`}>
                  Score: {passage.score}
                </span>
                <span className="px-2 py-1 text-xs bg-white/5 text-gray-400 rounded">
                  {passage.wordCount} words
                </span>
                {passage.isOptimalLength && (
                  <span className="px-2 py-1 text-xs bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">
                    Optimal
                  </span>
                )}
                {passage.answerFirst && (
                  <span className="px-2 py-1 text-xs bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20">
                    Answer-First
                  </span>
                )}
                {passage.hasCitation && (
                  <span className="px-2 py-1 text-xs bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">
                    Cited
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TrendsTab({ trends, loading }: { trends: GeoScoreTrend[]; loading: boolean }) {
  const [visibleLines, setVisibleLines] = useState({
    overall: true,
    citability: true,
    structure: false,
    multiModal: false,
    authority: false,
    technical: false,
  });

  const toggleLine = (key: keyof typeof visibleLines) => {
    setVisibleLines((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading && trends.length === 0) {
    return (
      <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (trends.length === 0) {
    return (
      <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
        <CardContent className="p-6">
          <div className="text-center py-12">
            <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No trend data yet</h3>
            <p className="text-gray-400">
              Run GEO readiness analyses to start tracking score trends over time.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = trends.map((point) => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    overall: point.overall,
    citability: point.citability,
    structure: point.structure,
    multiModal: point.multiModal,
    authority: point.authority,
    technical: point.technical,
  }));

  const lineConfig = [
    { key: 'overall', label: 'Overall', color: '#06b6d4' },
    { key: 'citability', label: 'Citability', color: '#22d3ee' },
    { key: 'structure', label: 'Structure', color: '#a855f7' },
    { key: 'multiModal', label: 'Multi-Modal', color: '#f59e0b' },
    { key: 'authority', label: 'Authority', color: '#10b981' },
    { key: 'technical', label: 'Technical', color: '#f43f5e' },
  ];

  return (
    <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
      <CardContent className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            Score Trends
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Track your GEO readiness scores over the last 30 days
          </p>
        </div>

        {/* Toggle Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {lineConfig.map((line) => (
            <Button
              key={line.key}
              variant="outline"
              size="sm"
              onClick={() => toggleLine(line.key as keyof typeof visibleLines)}
              className={`text-xs ${
                visibleLines[line.key as keyof typeof visibleLines]
                  ? 'bg-white/10 border-white/20'
                  : 'border-white/10 text-gray-500 hover:bg-white/5'
              }`}
              style={{
                borderColor: visibleLines[line.key as keyof typeof visibleLines] ? line.color : undefined,
                color: visibleLines[line.key as keyof typeof visibleLines] ? line.color : undefined,
              }}
            >
              {line.label}
            </Button>
          ))}
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              {lineConfig.map((line) => (
                <linearGradient key={line.key} id={`gradient-${line.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={line.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={line.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid rgba(6, 182, 212, 0.2)',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            {lineConfig.map(
              (line) =>
                visibleLines[line.key as keyof typeof visibleLines] && (
                  <Area
                    key={line.key}
                    type="monotone"
                    dataKey={line.key}
                    stroke={line.color}
                    strokeWidth={2}
                    fill={`url(#gradient-${line.key})`}
                    name={line.label}
                    connectNulls
                  />
                )
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function HistoryTab({ history, loading }: { history: GeoAnalysisHistoryItem[]; loading: boolean }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (loading && history.length === 0) {
    return (
      <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
        <CardContent className="p-6">
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No analysis history</h3>
            <p className="text-gray-400">
              Run your first GEO readiness analysis to see results tracked here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
      <CardContent className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Analysis History
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Past GEO readiness analyses and their results
          </p>
        </div>

        <div className="space-y-3">
          {history.map((entry) => {
            const isExpanded = expandedId === entry.id;
            const tierBadge = getTierBadge(
              entry.overallScore >= 80
                ? 'ready'
                : entry.overallScore >= 60
                  ? 'almost'
                  : entry.overallScore >= 40
                    ? 'needs-work'
                    : 'not-ready'
            );

            return (
              <div
                key={entry.id}
                className="bg-white/5 rounded-lg border border-white/10 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-lg ${getScoreBg(entry.overallScore)} flex items-center justify-center`}
                    >
                      <span className={`text-lg font-bold ${getScoreColor(entry.overallScore)}`}>
                        {entry.overallScore}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">
                        {entry.contentUrl || 'Manual input'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(entry.createdAt).toLocaleDateString()} •{' '}
                        {entry.platform.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full border ${tierBadge.className}`}
                  >
                    {tierBadge.label}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-white/5">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {[
                        { label: 'Citability', value: entry.citabilityScore },
                        { label: 'Structure', value: entry.structureScore },
                        { label: 'Multi-Modal', value: entry.multiModalScore },
                        { label: 'Authority', value: entry.authorityScore },
                        { label: 'Technical', value: entry.technicalScore },
                      ].map((dim) => (
                        <div key={dim.label} className="text-center p-2 bg-white/5 rounded">
                          <p className="text-xs text-gray-500">{dim.label}</p>
                          <p className={`text-lg font-semibold ${getScoreColor(dim.value)}`}>
                            {dim.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function GeoReadinessPage() {
  const [activeTab, setActiveTab] = useState<'check' | 'passages' | 'trends' | 'history'>('check');

  const {
    result,
    loading,
    error,
    analyzeReadiness,
    history,
    historyLoading,
    trends,
    trendsLoading,
  } = useGeoReadiness();

  const handleAnalyze = (content: string, url?: string, platform?: string) => {
    analyzeReadiness(content, url, platform);
  };

  const tabs = [
    { id: 'check' as const, label: 'Readiness Check' },
    { id: 'passages' as const, label: 'Passages' },
    { id: 'trends' as const, label: 'Trends' },
    { id: 'history' as const, label: 'History' },
  ];

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
            <Globe className="w-8 h-8 text-cyan-400" />
            GEO Readiness
          </h1>
          <p className="text-gray-400 mt-2">
            Assess content readiness for AI search engines and track optimization progress
          </p>
        </div>
      </div>

      <SEOFeatureGate
        feature="GEO Readiness"
        requiredPlan="professional"
        description="Access AI search readiness scoring with citability analysis, passage optimization, and platform-specific readiness tracking."
      >
        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-4">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant="ghost"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'check' && (
          <ReadinessCheckTab
            onAnalyze={handleAnalyze}
            loading={loading}
            error={error}
            result={result}
          />
        )}
        {activeTab === 'passages' && <PassagesTab result={result} />}
        {activeTab === 'trends' && <TrendsTab trends={trends} loading={trendsLoading} />}
        {activeTab === 'history' && <HistoryTab history={history} loading={historyLoading} />}
      </SEOFeatureGate>
    </div>
  );
}
