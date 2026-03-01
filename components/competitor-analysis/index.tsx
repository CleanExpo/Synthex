'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Target, BarChart3, Plus } from '@/components/icons';
import { notify } from '@/lib/notifications';

import type { Competitor } from './types';
import { CompetitorCard } from './CompetitorCard';
import { ComparisonView } from './ComparisonView';
import { CompetitorDetailView } from './CompetitorDetailView';
import {
  transformTrackingCompetitor,
  transformIntelligenceCompetitor,
  createEmptyCompetitor,
} from './helpers';

// Public type re-exports (consolidated from former index.ts)
export * from './types';
export { CompetitorCard } from './CompetitorCard';
export { ComparisonView } from './ComparisonView';
export { CompetitorDetailView } from './CompetitorDetailView';

export function CompetitorAnalysis() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompetitorUrl, setNewCompetitorUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadCompetitors();
  }, []);

  const loadCompetitors = async () => {
    setLoading(true);
    try {
      const [trackRes, intelRes] = await Promise.all([
        fetch('/api/competitors/track?active=true'),
        fetch('/api/intelligence/competitors?action=list'),
      ]);

      const loaded: Competitor[] = [];

      if (trackRes.ok) {
        const trackData = await trackRes.json();
        if (trackData.competitors && Array.isArray(trackData.competitors)) {
          for (const comp of trackData.competitors) {
            loaded.push(transformTrackingCompetitor(comp));
          }
        }
      }

      if (intelRes.ok) {
        const intelData = await intelRes.json();
        if (intelData.competitors && Array.isArray(intelData.competitors)) {
          for (const comp of intelData.competitors) {
            if (!loaded.some(c => c.id === comp.id)) {
              loaded.push(transformIntelligenceCompetitor(comp));
            }
          }
        }
      }

      setCompetitors(loaded);
      if (loaded.length > 0) setSelectedCompetitor(loaded[0]);
    } catch (error) {
      console.error('Error loading competitors:', error);
      notify.error('Failed to load competitors');
      setCompetitors([]);
    } finally {
      setLoading(false);
    }
  };

  const addCompetitor = async () => {
    if (!newCompetitorUrl) {
      notify.error('Please enter a competitor URL');
      return;
    }
    setLoading(true);
    try {
      let domain = newCompetitorUrl;
      let name = newCompetitorUrl;
      try {
        const url = new URL(newCompetitorUrl.startsWith('http') ? newCompetitorUrl : `https://${newCompetitorUrl}`);
        domain = url.hostname.replace(/^www\./, '');
        name = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
      } catch { /* use as-is */ }

      const response = await fetch('/api/competitors/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          domain: newCompetitorUrl.startsWith('http') ? newCompetitorUrl : `https://${newCompetitorUrl}`,
          description: 'Added for competitive analysis',
          trackingFrequency: 'daily',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          notify.error('Competitor with this domain already exists');
        } else {
          throw new Error(errorData.error || 'Failed to add competitor');
        }
        return;
      }

      const data = await response.json();
      setCompetitors([...competitors, createEmptyCompetitor(data, domain)]);
      setNewCompetitorUrl('');
      setShowAddForm(false);
      notify.success('Competitor added for tracking');
    } catch (error) {
      console.error('Error adding competitor:', error);
      notify.error('Failed to add competitor');
    } finally {
      setLoading(false);
    }
  };

  const toggleComparison = (competitorId: string) => {
    setSelectedForComparison(prev => {
      if (prev.includes(competitorId)) return prev.filter(id => id !== competitorId);
      if (prev.length >= 3) {
        notify.error('Maximum 3 competitors for comparison');
        return prev;
      }
      return [...prev, competitorId];
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/20">
            <Target className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Competitor Analysis</h2>
            <p className="text-gray-400">Track and analyze competitor performance</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setComparisonMode(!comparisonMode)}
            className={comparisonMode ? 'bg-cyan-500/20 border-cyan-500' : 'bg-white/5 border-white/10'}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Compare
          </Button>
          <Button onClick={() => setShowAddForm(true)} className="gradient-primary">
            <Plus className="h-4 w-4 mr-2" />
            Add Competitor
          </Button>
        </div>
      </div>

      {/* Add Competitor Form */}
      {showAddForm && (
        <Card variant="glass">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter competitor website or social profile URL..."
                value={newCompetitorUrl}
                onChange={(e) => setNewCompetitorUrl(e.target.value)}
                className="flex-1 bg-white/5 border-white/10"
              />
              <Button onClick={addCompetitor} disabled={loading}>
                {loading ? 'Analyzing...' : 'Add'}
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)} className="bg-white/5 border-white/10">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Competitors Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {competitors.map(competitor => (
          <CompetitorCard
            key={competitor.id}
            competitor={competitor}
            isSelected={selectedCompetitor?.id === competitor.id}
            isComparing={comparisonMode}
            isSelectedForComparison={selectedForComparison.includes(competitor.id)}
            onSelect={() => setSelectedCompetitor(competitor)}
            onToggleComparison={() => toggleComparison(competitor.id)}
          />
        ))}
      </div>

      {/* Comparison View */}
      {comparisonMode && selectedForComparison.length > 1 && (
        <ComparisonView competitors={competitors} selectedIds={selectedForComparison} />
      )}

      {/* Selected Competitor Details */}
      {selectedCompetitor && !comparisonMode && (
        <CompetitorDetailView
          competitor={selectedCompetitor}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )}
    </div>
  );
}

export default CompetitorAnalysis;
