'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SEOFeatureGate } from '@/components/seo';
import {
  useScheduledAudits,
  type ScheduledAuditTarget,
  type CreateTargetData,
} from '@/hooks/useScheduledAudits';
import {
  useAuditHistory,
  type AuditHistoryEntry,
  type AuditTrendPoint,
  type RegressionAlert,
} from '@/hooks/useAuditHistory';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft,
  Calendar,
  Loader2,
  Plus,
  Trash2,
  Play,
  Edit,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  Clock,
  Globe,
  Activity,
  ChevronDown,
  ChevronUp,
  X,
} from '@/components/icons';

// ============================================================================
// Helpers
// ============================================================================

function getFrequencyBadge(frequency: string): { label: string; className: string } {
  switch (frequency) {
    case 'daily':
      return { label: 'Daily', className: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' };
    case 'weekly':
      return { label: 'Weekly', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
    case 'monthly':
      return { label: 'Monthly', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    default:
      return { label: frequency, className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
  }
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-cyan-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBg(score: number | null): string {
  if (score === null) return 'bg-gray-500/10';
  if (score >= 80) return 'bg-emerald-500/10';
  if (score >= 60) return 'bg-cyan-500/10';
  if (score >= 40) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================================
// Tab: Scheduled Sites
// ============================================================================

function ScheduledSitesTab({
  targets,
  loading,
  error,
  onToggle,
  onDelete,
  onRunNow,
  onCreate,
  creating,
  auditRunning,
}: {
  targets: ScheduledAuditTarget[];
  loading: boolean;
  error: string | null;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onRunNow: (url: string) => void;
  onCreate: (data: CreateTargetData) => void;
  creating: boolean;
  auditRunning: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CreateTargetData>({
    url: '',
    name: '',
    frequency: 'weekly',
    alertThreshold: 10,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.url || !formData.name) return;
    onCreate(formData);
    setFormData({ url: '', name: '', frequency: 'weekly', alertThreshold: 10 });
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border-red-500/30">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-400">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Site Form */}
      {showForm ? (
        <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Add New Site</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Site URL</label>
                  <Input
                    type="url"
                    placeholder="https://example.com"
                    value={formData.url}
                    onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                    className="bg-white/5 border-cyan-500/20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Site Name</label>
                  <Input
                    type="text"
                    placeholder="Main Site"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-white/5 border-cyan-500/20"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Frequency</label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value as 'daily' | 'weekly' | 'monthly' }))}
                    className="w-full px-3 py-2 bg-white/5 border border-cyan-500/20 rounded-md text-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Alert Threshold ({formData.alertThreshold}% drop)
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    value={formData.alertThreshold}
                    onChange={(e) => setFormData(prev => ({ ...prev, alertThreshold: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  className="bg-gradient-to-r from-cyan-500 to-cyan-600"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Add Site
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowForm(true)} className="bg-gradient-to-r from-cyan-500 to-cyan-600">
          <Plus className="w-4 h-4 mr-2" />
          Add Site
        </Button>
      )}

      {/* Targets List */}
      {targets.length === 0 ? (
        <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
          <CardContent className="p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No scheduled audits yet</h3>
            <p className="text-gray-400 mb-6">Add a site to start monitoring its SEO health automatically.</p>
            <Button onClick={() => setShowForm(true)} className="bg-gradient-to-r from-cyan-500 to-cyan-600">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Site
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {targets.map((target) => {
            const freqBadge = getFrequencyBadge(target.frequency);
            return (
              <Card key={target.id} className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10 hover:border-cyan-500/30 transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Score Badge */}
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl ${getScoreBg(target.lastScore)} ${getScoreColor(target.lastScore)}`}>
                        {target.lastScore !== null ? Math.round(target.lastScore) : '—'}
                      </div>
                      {/* Info */}
                      <div>
                        <h3 className="text-lg font-semibold text-white">{target.name}</h3>
                        <p className="text-sm text-gray-400">{target.url}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded border ${freqBadge.className}`}>
                            {freqBadge.label}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last run: {formatDate(target.lastRunAt)}
                          </span>
                          <span className="text-xs text-gray-500">
                            Alert at {target.alertThreshold}% drop
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={target.enabled}
                        onCheckedChange={(checked) => onToggle(target.id, checked)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRunNow(target.url)}
                        disabled={auditRunning}
                        className="border-cyan-500/30 text-cyan-400"
                      >
                        {auditRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(target.id)}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tab: Audit History
// ============================================================================

function AuditHistoryTab({
  history,
  trends,
  loading,
  trendsLoading,
  urls,
  onUrlChange,
  selectedUrl,
}: {
  history: AuditHistoryEntry[];
  trends: AuditTrendPoint[];
  loading: boolean;
  trendsLoading: boolean;
  urls: string[];
  onUrlChange: (url: string) => void;
  selectedUrl: string;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* URL Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-gray-400">Filter by site:</label>
        <select
          value={selectedUrl}
          onChange={(e) => onUrlChange(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-cyan-500/20 rounded-md text-white"
        >
          <option value="">All Sites</option>
          {urls.map((url) => (
            <option key={url} value={url}>{new URL(url).hostname}</option>
          ))}
        </select>
      </div>

      {/* Trends Chart */}
      {selectedUrl && trends.length > 0 && (
        <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Score Trends (Last 30 Days)
            </h3>
            <div className="h-64">
              {trendsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="date"
                      stroke="#94a3b8"
                      tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis domain={[0, 100]} stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid rgba(6, 182, 212, 0.2)',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorScore)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History Table */}
      <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Audit History</h3>
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No audits found. Run your first audit to see history here.
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((audit) => {
                const isExpanded = expandedId === audit.id;
                const issues = audit.recommendations || [];
                return (
                  <div key={audit.id} className="bg-white/5 rounded-lg overflow-hidden">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5"
                      onClick={() => setExpandedId(isExpanded ? null : audit.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold ${getScoreBg(audit.overallScore)} ${getScoreColor(audit.overallScore)}`}>
                          {Math.round(audit.overallScore)}
                        </div>
                        <div>
                          <p className="font-medium text-white">{new URL(audit.url).hostname}</p>
                          <p className="text-sm text-gray-400">{issues.length} issues</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">
                          {new Date(audit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>
                    {isExpanded && issues.length > 0 && (
                      <div className="px-4 pb-4 border-t border-white/5">
                        <p className="text-sm text-gray-400 py-3">Top Issues:</p>
                        <div className="space-y-2">
                          {issues.slice(0, 5).map((issue, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <span className={`px-1.5 py-0.5 text-xs rounded ${
                                issue.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {issue.severity}
                              </span>
                              <span className="text-gray-300">{issue.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Tab: Alerts & Regressions
// ============================================================================

function AlertsTab({
  regressions,
  loading,
}: {
  regressions: RegressionAlert[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (regressions.length === 0) {
    return (
      <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
        <CardContent className="p-12 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No regressions detected</h3>
          <p className="text-gray-400">Your sites are performing well! Keep up the good work.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {regressions.map((regression) => (
        <Card
          key={regression.id}
          className={`bg-[#0f172a]/80 backdrop-blur-xl border ${
            regression.severity === 'critical' ? 'border-red-500/30' : 'border-amber-500/30'
          }`}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {/* Severity Icon */}
                <div className={`p-3 rounded-xl ${
                  regression.severity === 'critical' ? 'bg-red-500/20' : 'bg-amber-500/20'
                }`}>
                  <TrendingDown className={`w-6 h-6 ${
                    regression.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                  }`} />
                </div>
                {/* Info */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-white">{regression.siteName}</h3>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      regression.severity === 'critical'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {regression.severity === 'critical' ? 'Critical' : 'Warning'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">{regression.url}</p>
                  {/* Score Drop */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-2xl font-bold">
                      <span className="text-emerald-400">{regression.oldScore}</span>
                      <span className="text-gray-500 mx-2">→</span>
                      <span className="text-red-400">{regression.newScore}</span>
                    </div>
                    <span className="text-red-400 font-medium">
                      ↓ {regression.dropPercent}% drop
                    </span>
                  </div>
                  {/* Top Issues */}
                  {regression.topIssues.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-400 mb-2">Top Issues:</p>
                      <div className="space-y-1">
                        {regression.topIssues.map((issue, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <AlertTriangle className={`w-3 h-3 ${
                              issue.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                            }`} />
                            <span className="text-gray-300">{issue.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Date */}
              <span className="text-sm text-gray-500">
                {formatDate(regression.createdAt)}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function ScheduledAuditsPage() {
  const [activeTab, setActiveTab] = useState<'sites' | 'history' | 'alerts'>('sites');
  const [selectedUrl, setSelectedUrl] = useState('');

  const {
    targets,
    loading,
    error,
    createTarget,
    deleteTarget,
    toggleEnabled,
    runManualAudit,
    creating,
    auditRunning,
  } = useScheduledAudits();

  const {
    history,
    historyLoading,
    trends,
    trendsLoading,
    regressions,
    loadTrends,
    getUniqueUrls,
  } = useAuditHistory();

  const handleUrlChange = (url: string) => {
    setSelectedUrl(url);
    if (url) {
      loadTrends(url);
    }
  };

  const tabs = [
    { id: 'sites' as const, label: 'Scheduled Sites', icon: Calendar },
    { id: 'history' as const, label: 'Audit History', icon: Activity },
    { id: 'alerts' as const, label: 'Alerts & Regressions', icon: AlertTriangle, count: regressions.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/seo">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to SEO Tools
            </Button>
          </Link>
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Calendar className="w-8 h-8 text-cyan-400" />
          Scheduled Audits
        </h1>
        <p className="text-gray-400 mt-2">
          Automate recurring SEO audits with regression detection and email alerts
        </p>
      </div>

      <SEOFeatureGate
        feature="Scheduled SEO Audits"
        requiredPlan="professional"
        description="Set up automated SEO audits that run on schedule and alert you when scores drop."
      >
        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-cyan-500/10 pb-4">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant="ghost"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
                  {tab.count}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'sites' && (
          <ScheduledSitesTab
            targets={targets}
            loading={loading}
            error={error}
            onToggle={toggleEnabled}
            onDelete={deleteTarget}
            onRunNow={runManualAudit}
            onCreate={createTarget}
            creating={creating}
            auditRunning={auditRunning}
          />
        )}
        {activeTab === 'history' && (
          <AuditHistoryTab
            history={history}
            trends={trends}
            loading={historyLoading}
            trendsLoading={trendsLoading}
            urls={getUniqueUrls()}
            onUrlChange={handleUrlChange}
            selectedUrl={selectedUrl}
          />
        )}
        {activeTab === 'alerts' && (
          <AlertsTab
            regressions={regressions}
            loading={historyLoading}
          />
        )}
      </SEOFeatureGate>
    </div>
  );
}
