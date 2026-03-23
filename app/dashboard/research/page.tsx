'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Plus,
  Award,
  Database,
  Eye,
  RefreshCw,
  Brain,
  Zap,
  Loader2,
  TrendingUp,
  AlertCircle,
  Globe,
  Filter,
} from '@/components/icons';
import { GEOFeatureGate } from '@/components/geo/GEOFeatureGate';
import { HelpVideo } from '@/components/ui/HelpVideo';

interface ResearchReport {
  id: number;
  title: string;
  slug: string;
  status: string;
  sasScore: number | null;
  createdAt: string;
  updatedAt: string;
  _count?: { visuals: number };
}

// --- Auto-Research types ---
interface AutoResearchRun {
  id: string;
  runType: 'daily_trends' | 'weekly_deep';
  status: 'running' | 'completed' | 'failed';
  platforms: string[];
  insightsCount: number;
  promptsUpdated: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface TrendInsight {
  id: string;
  platform: string;
  category: string;
  insight: string;
  confidence: number;
  dataPoints: number;
  createdAt: string;
}

// --- AutoResearchSection ---
function AutoResearchSection() {
  const [runs, setRuns] = useState<AutoResearchRun[]>([]);
  const [insights, setInsights] = useState<TrendInsight[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<string>('all');

  useEffect(() => {
    fetchRuns();
    fetchInsights();
  }, []);

  const fetchRuns = async () => {
    try {
      setRunsLoading(true);
      const res = await fetch('/api/auto-research', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRuns((data.runs ?? []).slice(0, 5));
      }
    } catch (err) {
      console.error('[AutoResearchSection] fetchRuns:', err);
    } finally {
      setRunsLoading(false);
    }
  };

  const fetchInsights = async () => {
    try {
      setInsightsLoading(true);
      const res = await fetch('/api/auto-research/insights?limit=20', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights ?? []);
      }
    } catch (err) {
      console.error('[AutoResearchSection] fetchInsights:', err);
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const res = await fetch('/api/auto-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'daily_trends' }),
      });
      if (res.ok) {
        fetchRuns();
      }
    } catch (err) {
      console.error('[AutoResearchSection] trigger:', err);
    } finally {
      setTriggering(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'completed')
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
          completed
        </Badge>
      );
    if (status === 'running')
      return (
        <Badge className="bg-orange-500/20 text-orange-400 border-0 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          running
        </Badge>
      );
    return (
      <Badge className="bg-red-500/20 text-red-400 border-0">failed</Badge>
    );
  };

  const categoryColour = (cat: string) => {
    const map: Record<string, string> = {
      hook: 'bg-orange-500/20 text-orange-400',
      visual_style: 'bg-orange-500/20 text-orange-400',
      hashtag: 'bg-blue-500/20 text-blue-400',
      topic: 'bg-orange-500/20 text-orange-400',
      format: 'bg-orange-500/20 text-orange-400',
      cta: 'bg-emerald-500/20 text-emerald-400',
    };
    return map[cat] ?? 'bg-white/10 text-white/50';
  };

  const availablePlatforms = Array.from(
    new Set(insights.map(i => i.platform))
  ).sort();

  const filteredInsights =
    platformFilter === 'all'
      ? insights
      : insights.filter(i => i.platform === platformFilter);

  const isLatestRunning = runs[0]?.status === 'running';

  return (
    <div className="space-y-4 mb-8">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-orange-400" />
          <h2 className="text-lg font-semibold text-white">Auto-Research</h2>
          <span className="text-xs text-white/50 ml-1">
            Self-learning trend intelligence
          </span>
        </div>
        <Button
          onClick={handleTrigger}
          disabled={triggering || isLatestRunning}
          className="bg-orange-600 hover:bg-orange-700 text-white text-xs"
          size="sm"
        >
          <Zap className="h-3.5 w-3.5 mr-1.5" />
          {triggering ? 'Queuing…' : 'Run Now'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Research Runs card */}
        <Card className="bg-surface-base/80 border border-orange-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white/70 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-orange-400/60" />
              Research Runs
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {runsLoading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 bg-white/[0.04] rounded-sm" />
                ))}
              </div>
            ) : runs.length === 0 ? (
              <div className="py-6 text-center">
                <Brain className="h-8 w-8 mx-auto mb-2 text-white/50" />
                <p className="text-sm text-white/50">
                  No runs yet — click Run Now to start
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {runs.map(run => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between px-3 py-2 border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {statusBadge(run.status)}
                      <span className="text-xs text-white/40 truncate">
                        {new Date(run.startedAt).toLocaleString('en-AU', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs text-white/50">
                      <span>{run.insightsCount} insights</span>
                      <span className="capitalize text-white/50">
                        {run.runType.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Insights card */}
        <Card className="bg-surface-base/80 border border-orange-500/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-white/70 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-400/60" />
                Live Insights
                {insights.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-orange-500/10 text-orange-400/70 ml-1">
                    {insights.length}
                  </span>
                )}
              </CardTitle>
              {availablePlatforms.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3 w-3 text-white/50" />
                  <select
                    value={platformFilter}
                    onChange={e => setPlatformFilter(e.target.value)}
                    className="text-xs bg-white/[0.04] border border-white/[0.08] text-white/50 rounded-sm px-2 py-0.5 focus:outline-none focus:border-orange-500/30"
                  >
                    <option value="all">All platforms</option>
                    {availablePlatforms.map(p => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {insightsLoading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-12 bg-white/[0.04] rounded-sm" />
                ))}
              </div>
            ) : filteredInsights.length === 0 ? (
              <div className="py-6 text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-white/50" />
                <p className="text-sm text-white/50">
                  No insights yet — run a research cycle to start learning
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filteredInsights.map(insight => (
                  <div
                    key={insight.id}
                    className="flex gap-2 items-start px-3 py-2 border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm"
                  >
                    <Globe className="h-3 w-3 text-orange-400/40 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/70 leading-relaxed">
                        {insight.insight}
                      </p>
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-white/[0.06] text-white/40">
                          {insight.platform}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-sm ${categoryColour(insight.category)}`}
                        >
                          {insight.category}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-white/[0.04] text-white/50">
                          {Math.round(insight.confidence * 100)}% conf
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ResearchPage() {
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newReport, setNewReport] = useState({
    title: '',
    executiveSummary: '',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/research', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createReport = async () => {
    if (!newReport.title || newReport.title.length < 5) return;
    setCreating(true);
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newReport),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewReport({ title: '', executiveSummary: '' });
        fetchReports();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-500/20 text-gray-300',
    review: 'bg-orange-500/20 text-orange-400',
    published: 'bg-emerald-500/20 text-emerald-400',
  };

  return (
    <>
      {/* Auto-Research section — shown outside the GEO feature gate */}
      <AutoResearchSection />

      <GEOFeatureGate
        feature="Research Reports"
        requiredPlan="professional"
        description="Generate original research with first-party data that becomes a citation magnet for AI search engines."
        benefits={[
          'First-party data research generation',
          'SAS (Synthex Authority Score) methodology',
          'Paper Banana visualizations for reports',
        ]}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <Database className="h-7 w-7 text-orange-400" />
                Research Reports
              </h1>
              <p className="text-gray-300 mt-1">
                Create first-party data citation magnets for AI search engines
              </p>
            </div>
            <div className="flex items-center gap-3">
              <HelpVideo videoId="feature-tour-research" />
              <Button
                onClick={() => setShowCreate(!showCreate)}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Report
              </Button>
            </div>
          </div>

          {showCreate && (
            <Card className="bg-surface-base/80 border border-orange-500/10">
              <CardContent className="p-6 space-y-4">
                <input
                  value={newReport.title}
                  onChange={e =>
                    setNewReport({ ...newReport, title: e.target.value })
                  }
                  placeholder="Report title (e.g., '2026 Digital Marketing Benchmark Report')"
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-4 py-2 text-sm placeholder:text-gray-500"
                />
                <textarea
                  value={newReport.executiveSummary}
                  onChange={e =>
                    setNewReport({
                      ...newReport,
                      executiveSummary: e.target.value,
                    })
                  }
                  placeholder="Executive summary (optional)"
                  className="w-full h-20 bg-white/5 border border-white/10 text-white rounded-lg px-4 py-2 text-sm placeholder:text-gray-500 resize-y"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={createReport}
                    disabled={creating || newReport.title.length < 5}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {creating ? 'Creating...' : 'Create Report'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <Card
                  key={i}
                  className="bg-surface-base/80 border border-orange-500/10"
                >
                  <CardContent className="p-6 animate-pulse">
                    <div className="h-6 bg-white/10 rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : reports.length === 0 ? (
            <Card className="bg-surface-base/80 border border-orange-500/10">
              <CardContent className="p-12 text-center text-gray-300">
                <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No research reports yet</p>
                <p className="text-sm mt-1">
                  Create original research to become a citation magnet
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reports.map(report => (
                <Card
                  key={report.id}
                  className="bg-surface-base/80 border border-orange-500/10 hover:border-orange-500/30 transition-all"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {report.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-2">
                          <Badge
                            className={
                              statusColors[report.status] || statusColors.draft
                            }
                          >
                            {report.status}
                          </Badge>
                          {report.sasScore !== null && (
                            <Badge
                              className={`${report.sasScore >= 7 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}
                            >
                              <Award className="h-3 w-3 mr-1" />
                              SAS: {report.sasScore.toFixed(1)}
                            </Badge>
                          )}
                          <span className="text-xs text-gray-500">
                            {report._count?.visuals || 0} visuals
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(report.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-orange-400"
                      >
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </GEOFeatureGate>
    </>
  );
}
