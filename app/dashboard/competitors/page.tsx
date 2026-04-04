'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import { toast } from 'sonner';
import { useCompetitorTracking } from '@/hooks/useCompetitorTracking';
import type { CompetitorAlert } from '@/hooks/useCompetitorTracking';
import {
  TrendingUp,
  Users,
  BarChart3,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  Target,
  AlertTriangle,
  X,
  Bell,
  Check,
  Eye,
} from '@/components/icons';

interface Competitor {
  id: string;
  name: string;
  handles: Record<string, string>;
  website?: string;
  industry?: string;
  isActive: boolean;
  addedAt: string;
}

interface Insight {
  type: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Hook for alerts and snapshots
  const { listAlerts, markAlertsRead, triggerSnapshot } =
    useCompetitorTracking();

  // Alerts state
  const [alerts, setAlerts] = useState<CompetitorAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [isSnapshotting, setIsSnapshotting] = useState(false);

  // Add competitor form state
  const [newName, setNewName] = useState('');
  const [newTwitter, setNewTwitter] = useState('');
  const [newInstagram, setNewInstagram] = useState('');
  const [newLinkedin, setNewLinkedin] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const result = await listAlerts({ limit: 20 });
      if (result) {
        setAlerts(result.alerts);
      }
    } catch {
      // Alerts are non-critical — fail silently
    } finally {
      setAlertsLoading(false);
    }
  }, [listAlerts]);

  const handleMarkAlertRead = useCallback(
    async (alertId: string) => {
      const success = await markAlertsRead([alertId]);
      if (success) {
        setAlerts(prev =>
          prev.map(a => (a.id === alertId ? { ...a, isRead: true } : a))
        );
      }
    },
    [markAlertsRead]
  );

  const handleTriggerSnapshot = useCallback(async () => {
    const firstCompetitor = competitors[0];
    if (!firstCompetitor) {
      toast.error('No competitors to snapshot');
      return;
    }
    setIsSnapshotting(true);
    try {
      const result = await triggerSnapshot(firstCompetitor.id);
      if (result) {
        toast.success(`Snapshot captured for ${firstCompetitor.name}`);
        fetchAlerts();
      }
    } finally {
      setIsSnapshotting(false);
    }
  }, [competitors, triggerSnapshot, fetchAlerts]);

  const fetchData = useCallback(async () => {
    try {
      const [compRes, insightRes] = await Promise.all([
        fetch('/api/intelligence/competitors?action=list', {
          credentials: 'include',
        }),
        fetch('/api/intelligence/competitors?action=insights', {
          credentials: 'include',
        }),
      ]);

      if (compRes.ok) {
        const compData = await compRes.json();
        const compList = compData.data || compData.competitors || [];
        setCompetitors(Array.isArray(compList) ? compList : []);
      }

      if (insightRes.ok) {
        const insightData = await insightRes.json();
        const raw = insightData.data ?? insightData.insights;
        if (Array.isArray(raw)) {
          setInsights(raw);
        } else if (raw && typeof raw === 'object') {
          // API returns { actionItems, strengths, weaknesses, ... } — transform to Insight[]
          const transformed: Insight[] = (raw.actionItems ?? []).map(
            (item: {
              priority: 'high' | 'medium' | 'low';
              action: string;
            }) => ({
              type: 'action',
              title: item.action,
              description: item.action,
              priority: item.priority,
              actionable: true,
            })
          );
          setInsights(transformed);
        }
      }

      setError(null);
    } catch {
      setError('Failed to load competitive intelligence data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchAlerts();
  }, [fetchData, fetchAlerts]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleAddCompetitor = useCallback(async () => {
    if (!newName.trim()) {
      toast.error('Competitor name is required');
      return;
    }

    const handles: Record<string, string> = {};
    if (newTwitter.trim()) handles.twitter = newTwitter.trim();
    if (newInstagram.trim()) handles.instagram = newInstagram.trim();
    if (newLinkedin.trim()) handles.linkedin = newLinkedin.trim();

    if (Object.keys(handles).length === 0) {
      toast.error('At least one social handle is required');
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetch('/api/intelligence/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'add',
          name: newName.trim(),
          handles,
          website: newWebsite.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast.success(`${newName} added to tracking`);
        setShowAddForm(false);
        setNewName('');
        setNewTwitter('');
        setNewInstagram('');
        setNewLinkedin('');
        setNewWebsite('');
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to add competitor');
      }
    } catch {
      toast.error('Failed to add competitor');
    } finally {
      setIsAdding(false);
    }
  }, [newName, newTwitter, newInstagram, newLinkedin, newWebsite, fetchData]);

  const handleRemove = useCallback(async (id: string, name: string) => {
    try {
      const res = await fetch(
        `/api/intelligence/competitors?competitorId=${id}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (res.ok) {
        toast.success(`${name} removed`);
        setCompetitors(prev => prev.filter(c => c.id !== id));
      } else {
        toast.error('Failed to remove competitor');
      }
    } catch {
      toast.error('Failed to remove competitor');
    }
  }, []);

  if (isLoading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="p-6">
        <APIErrorCard
          title="Competitive Intelligence Error"
          message={error}
          onRetry={fetchData}
        />
      </div>
    );
  }

  const highPriorityInsights = insights.filter(i => i.priority === 'high');
  const activeCompetitors = competitors.filter(c => c.isActive);
  const unreadAlerts = alerts.filter(a => !a.isRead);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-2 block">
            Intelligence
          </span>
          <h1 className="text-3xl sm:text-4xl font-extralight tracking-tight text-white">
            Competitive Intelligence
          </h1>
          <p className="mt-1.5 text-sm text-white/40 leading-relaxed">
            Track competitors and discover opportunities
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-sm bg-white/[0.02] border-[0.5px] border-white/[0.06] text-white/40 hover:bg-white/[0.04] hover:text-white transition-colors text-sm disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
          {competitors.length > 0 && (
            <button
              onClick={handleTriggerSnapshot}
              disabled={isSnapshotting}
              className="flex items-center gap-2 px-3 py-2 rounded-sm bg-white/[0.02] border-[0.5px] border-white/[0.06] text-white/40 hover:bg-white/[0.04] hover:text-white transition-colors text-sm disabled:opacity-50"
            >
              <Eye
                className={`h-4 w-4 ${isSnapshotting ? 'animate-pulse' : ''}`}
              />
              {isSnapshotting ? 'Capturing...' : 'Snapshot Data'}
            </button>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-sm bg-orange-500/20 border-[0.5px] border-orange-500/30 text-orange-400 hover:bg-orange-500/30 transition-colors text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Competitor
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Competitors Tracked',
            value: activeCompetitors.length,
            icon: Users,
            color: 'text-orange-400',
          },
          {
            label: 'Total Monitored',
            value: competitors.length,
            icon: BarChart3,
            color: 'text-orange-400',
          },
          {
            label: 'High Priority Insights',
            value: highPriorityInsights.length,
            icon: AlertTriangle,
            color: 'text-yellow-400',
          },
          {
            label: 'Unread Alerts',
            value: unreadAlerts.length,
            icon: Bell,
            color:
              unreadAlerts.length > 0 ? 'text-orange-400' : 'text-green-400',
          },
        ].map(stat => (
          <div
            key={stat.label}
            className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div className="text-2xl font-mono tabular-nums font-light text-white">
              {stat.value}
            </div>
            <div className="text-xs text-white/40 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Competitors Grid */}
      <div>
        <h2 className="text-sm uppercase tracking-[0.2em] text-white/40 mb-4">
          Tracked Competitors
        </h2>
        {competitors.length === 0 ? (
          <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-12 text-center">
            <Target className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-base font-light text-white mb-2">
              No competitors tracked yet
            </h3>
            <p className="text-white/40 mb-4">
              Add your first competitor to start monitoring their social media
              performance.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 rounded-sm bg-orange-500/20 border-[0.5px] border-orange-500/30 text-orange-400 hover:bg-orange-500/30 transition-colors text-sm"
            >
              Add First Competitor
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {competitors.map(comp => (
              <div
                key={comp.id}
                className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-medium">{comp.name}</h3>
                    {comp.website && (
                      <a
                        href={comp.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 mt-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {comp.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 ${comp.isActive ? 'bg-green-400' : 'bg-slate-600'}`}
                  />
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {Object.entries(comp.handles || {}).map(
                    ([platform, handle]) => (
                      <span
                        key={platform}
                        className="text-xs bg-white/[0.03] text-white/40 px-2 py-1 rounded-sm capitalize"
                      >
                        {platform}: @{handle}
                      </span>
                    )
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-xs text-white/50">
                    Added {new Date(comp.addedAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleRemove(comp.id, comp.name)}
                    className="text-white/50 hover:text-red-400 transition-colors"
                    title="Remove competitor"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alerts */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm uppercase tracking-[0.2em] text-white/40">
            Competitor Alerts
          </h2>
          {alerts.filter(a => !a.isRead).length > 0 && (
            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-sm tabular-nums">
              {alerts.filter(a => !a.isRead).length} unread
            </span>
          )}
          {alertsLoading && (
            <RefreshCw className="h-3 w-3 text-white/50 animate-spin" />
          )}
        </div>
        {alerts.length === 0 ? (
          <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-8 text-center">
            <Bell className="h-8 w-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-white/40">No competitor alerts</p>
            <p className="text-xs text-white/50 mt-1">
              Alerts will appear when notable competitor activity is detected.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 10).map(alert => (
              <div
                key={alert.id}
                className={`border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4 flex items-start gap-3 transition-colors ${
                  !alert.isRead ? 'border-l-2 border-l-orange-500/40' : ''
                }`}
              >
                <div
                  className={`p-1.5 rounded-sm shrink-0 mt-0.5 ${
                    alert.severity === 'important'
                      ? 'bg-red-500/10'
                      : alert.severity === 'warning'
                        ? 'bg-yellow-500/10'
                        : 'bg-blue-500/10'
                  }`}
                >
                  <AlertTriangle
                    className={`h-3.5 w-3.5 ${
                      alert.severity === 'important'
                        ? 'text-red-400'
                        : alert.severity === 'warning'
                          ? 'text-yellow-400'
                          : 'text-blue-400'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-light text-white truncate">
                      {alert.title}
                    </h3>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-sm shrink-0 ${
                        alert.severity === 'important'
                          ? 'bg-red-500/10 text-red-400'
                          : alert.severity === 'warning'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : 'bg-blue-500/10 text-blue-400'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs text-white/40 line-clamp-2">
                    {alert.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    {alert.competitor && (
                      <span className="text-[10px] text-white/50">
                        {alert.competitor.name}
                      </span>
                    )}
                    <span className="text-[10px] text-white/50">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {!alert.isRead && (
                  <button
                    onClick={() => handleMarkAlertRead(alert.id)}
                    className="shrink-0 flex items-center gap-1 text-[10px] text-white/50 hover:text-orange-400 transition-colors px-2 py-1 rounded-sm bg-white/[0.02] border-[0.5px] border-white/[0.06]"
                    title="Mark as read"
                  >
                    <Check className="h-3 w-3" />
                    Read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div>
          <h2 className="text-sm uppercase tracking-[0.2em] text-white/40 mb-4">
            Strategic Insights
          </h2>
          <div className="space-y-3">
            {insights.slice(0, 8).map((insight, i) => (
              <div
                key={i}
                className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4 flex items-start gap-4"
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    insight.priority === 'high'
                      ? 'bg-red-500/10'
                      : insight.priority === 'medium'
                        ? 'bg-yellow-500/10'
                        : 'bg-green-500/10'
                  }`}
                >
                  <TrendingUp
                    className={`h-4 w-4 ${
                      insight.priority === 'high'
                        ? 'text-red-400'
                        : insight.priority === 'medium'
                          ? 'text-yellow-400'
                          : 'text-green-400'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-light text-white">
                      {insight.title}
                    </h3>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-sm ${
                        insight.priority === 'high'
                          ? 'bg-red-500/10 text-red-400'
                          : insight.priority === 'medium'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : 'bg-green-500/10 text-green-400'
                      }`}
                    >
                      {insight.priority}
                    </span>
                  </div>
                  <p className="text-sm text-white/40">{insight.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Competitor Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="border-[0.5px] border-white/[0.06] bg-[#0a0a0a] rounded-sm p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-light text-white">
                Add Competitor
              </h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full px-3 py-2 bg-white/[0.03] border-[0.5px] border-white/[0.06] rounded-sm text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-orange-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">
                  Twitter Handle
                </label>
                <input
                  type="text"
                  value={newTwitter}
                  onChange={e => setNewTwitter(e.target.value)}
                  placeholder="@username"
                  className="w-full px-3 py-2 bg-white/[0.03] border-[0.5px] border-white/[0.06] rounded-sm text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-orange-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">
                  Instagram Handle
                </label>
                <input
                  type="text"
                  value={newInstagram}
                  onChange={e => setNewInstagram(e.target.value)}
                  placeholder="@username"
                  className="w-full px-3 py-2 bg-white/[0.03] border-[0.5px] border-white/[0.06] rounded-sm text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-orange-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">
                  LinkedIn Handle
                </label>
                <input
                  type="text"
                  value={newLinkedin}
                  onChange={e => setNewLinkedin(e.target.value)}
                  placeholder="company-slug"
                  className="w-full px-3 py-2 bg-white/[0.03] border-[0.5px] border-white/[0.06] rounded-sm text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-orange-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">
                  Website (optional)
                </label>
                <input
                  type="url"
                  value={newWebsite}
                  onChange={e => setNewWebsite(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 bg-white/[0.03] border-[0.5px] border-white/[0.06] rounded-sm text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-orange-500/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-sm bg-white/[0.02] border-[0.5px] border-white/[0.06] text-white/40 hover:bg-white/[0.04] text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCompetitor}
                disabled={isAdding}
                className="px-4 py-2 rounded-sm bg-orange-500/20 border-[0.5px] border-orange-500/30 text-orange-400 hover:bg-orange-500/30 text-sm disabled:opacity-50"
              >
                {isAdding ? 'Adding...' : 'Add Competitor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
