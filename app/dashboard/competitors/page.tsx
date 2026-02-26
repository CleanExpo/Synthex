'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import { toast } from 'sonner';
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
  Zap,
  X,
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

  // Add competitor form state
  const [newName, setNewName] = useState('');
  const [newTwitter, setNewTwitter] = useState('');
  const [newInstagram, setNewInstagram] = useState('');
  const [newLinkedin, setNewLinkedin] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [compRes, insightRes] = await Promise.all([
        fetch('/api/intelligence/competitors?action=list', { credentials: 'include' }),
        fetch('/api/intelligence/competitors?action=insights', { credentials: 'include' }),
      ]);

      if (compRes.ok) {
        const compData = await compRes.json();
        setCompetitors(compData.data || compData.competitors || []);
      }

      if (insightRes.ok) {
        const insightData = await insightRes.json();
        setInsights(insightData.data || insightData.insights || []);
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
  }, [fetchData]);

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
      const res = await fetch(`/api/intelligence/competitors?competitorId=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

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
        <APIErrorCard title="Competitive Intelligence Error" message={error} onRetry={fetchData} />
      </div>
    );
  }

  const highPriorityInsights = insights.filter(i => i.priority === 'high');
  const activeCompetitors = competitors.filter(c => c.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Competitive Intelligence</h1>
          <p className="text-slate-400 mt-1">Track competitors and discover opportunities</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors text-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Competitor
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Competitors Tracked', value: activeCompetitors.length, icon: Users, color: 'text-cyan-400' },
          { label: 'Total Monitored', value: competitors.length, icon: BarChart3, color: 'text-purple-400' },
          { label: 'High Priority Insights', value: highPriorityInsights.length, icon: AlertTriangle, color: 'text-yellow-400' },
          { label: 'Total Insights', value: insights.length, icon: Zap, color: 'text-green-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Competitors Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Tracked Competitors</h2>
        {competitors.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-12 text-center">
            <Target className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No competitors tracked yet</h3>
            <p className="text-slate-400 mb-4">Add your first competitor to start monitoring their social media performance.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 transition-colors text-sm font-medium"
            >
              Add First Competitor
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {competitors.map(comp => (
              <div key={comp.id} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 hover:bg-white/[0.08] transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-medium">{comp.name}</h3>
                    {comp.website && (
                      <a href={comp.website} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-1">
                        <ExternalLink className="h-3 w-3" />
                        {comp.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </div>
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${comp.isActive ? 'bg-green-400' : 'bg-slate-600'}`} />
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {Object.entries(comp.handles || {}).map(([platform, handle]) => (
                    <span key={platform} className="text-xs bg-white/5 text-slate-400 px-2 py-1 rounded capitalize">
                      {platform}: @{handle}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-xs text-slate-500">
                    Added {new Date(comp.addedAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleRemove(comp.id, comp.name)}
                    className="text-slate-500 hover:text-red-400 transition-colors"
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

      {/* Insights */}
      {insights.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Strategic Insights</h2>
          <div className="space-y-3">
            {insights.slice(0, 8).map((insight, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 flex items-start gap-4">
                <div className={`p-2 rounded-lg shrink-0 ${
                  insight.priority === 'high' ? 'bg-red-500/10' :
                  insight.priority === 'medium' ? 'bg-yellow-500/10' : 'bg-green-500/10'
                }`}>
                  <TrendingUp className={`h-4 w-4 ${
                    insight.priority === 'high' ? 'text-red-400' :
                    insight.priority === 'medium' ? 'text-yellow-400' : 'text-green-400'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-white">{insight.title}</h3>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      insight.priority === 'high' ? 'bg-red-500/10 text-red-400' :
                      insight.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-green-500/10 text-green-400'
                    }`}>
                      {insight.priority}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">{insight.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Competitor Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add Competitor</h2>
              <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Company Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Twitter Handle</label>
                <input
                  type="text"
                  value={newTwitter}
                  onChange={e => setNewTwitter(e.target.value)}
                  placeholder="@username"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Instagram Handle</label>
                <input
                  type="text"
                  value={newInstagram}
                  onChange={e => setNewInstagram(e.target.value)}
                  placeholder="@username"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">LinkedIn Handle</label>
                <input
                  type="text"
                  value={newLinkedin}
                  onChange={e => setNewLinkedin(e.target.value)}
                  placeholder="company-slug"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Website (optional)</label>
                <input
                  type="url"
                  value={newWebsite}
                  onChange={e => setNewWebsite(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCompetitor}
                disabled={isAdding}
                className="px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 text-sm font-medium disabled:opacity-50"
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
