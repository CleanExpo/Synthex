'use client';

/**
 * /dashboard/experiments
 *
 * Autonomous A/B Testing & Self-Healing Agent dashboard.
 * 3 tabs: Experiments (SEO A/B tests) | Self-Healing | Dog-food
 */

import { useState, useCallback , Suspense } from 'react';
import useSWR from 'swr';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Beaker,
  Plus,
  RefreshCw,
  AlertCircle,
  Globe,
  ShieldExclamation,
} from '@/components/icons';
import { ExperimentCard } from '@/components/experiments/ExperimentCard';
import { ExperimentWizard } from '@/components/experiments/ExperimentWizard';
import { HealingPanel } from '@/components/experiments/HealingPanel';
import { DogfoodScorecard } from '@/components/experiments/DogfoodScorecard';
import { DashboardSkeleton } from '@/components/skeletons';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type TabId = 'experiments' | 'healing' | 'dogfood';

interface Experiment {
  id: string;
  name: string;
  description?: string | null;
  experimentType: string;
  targetUrl: string;
  hypothesis: string;
  metricToTrack: string;
  originalValue: string;
  variantValue: string;
  status: string;
  winnerVariant?: string | null;
  baselineScore?: number | null;
  variantScore?: number | null;
  improvement?: number | null;
  createdAt: string;
  observations?: Array<{ id: string; variant: string; metricValue: number; recordedAt: string }>;
}

// ============================================================================
// SWR Fetcher
// ============================================================================

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

// ============================================================================
// Tabs config
// ============================================================================

const TABS: Array<{
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    id: 'experiments',
    label: 'Experiments',
    icon: Beaker,
    description: 'SEO A/B tests',
  },
  {
    id: 'healing',
    label: 'Self-Healing',
    icon: ShieldExclamation,
    description: 'Detect & fix issues',
  },
  {
    id: 'dogfood',
    label: 'Dog-food',
    icon: Globe,
    description: 'Synthex self-check',
  },
];

// ============================================================================
// Experiments Tab
// ============================================================================

function ExperimentsTab() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const queryParams = new URLSearchParams();
  if (statusFilter !== 'all') queryParams.set('status', statusFilter);
  if (typeFilter !== 'all') queryParams.set('type', typeFilter);
  const queryString = queryParams.toString();

  const { data, isLoading, mutate } = useSWR<{
    experiments: Experiment[];
    pagination: { total: number };
  }>(
    `/api/experiments/experiments${queryString ? '?' + queryString : ''}`,
    fetchJson
  );

  const experiments = data?.experiments ?? [];
  const total = data?.pagination?.total ?? 0;

  const runningCount = experiments.filter((e) => e.status === 'running').length;
  const completedCount = experiments.filter((e) => e.status === 'completed').length;

  const handleRefresh = useCallback(() => mutate(), [mutate]);

  const handleWizardCreated = useCallback(() => {
    setWizardOpen(false);
    mutate();
  }, [mutate]);

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: total, colour: 'text-white' },
          { label: 'Running', value: runningCount, colour: 'text-green-400' },
          { label: 'Completed', value: completedCount, colour: 'text-blue-400' },
          {
            label: 'Draft',
            value: experiments.filter((e) => e.status === 'draft').length,
            colour: 'text-gray-400',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-4 bg-white/5 rounded-lg border border-white/10 text-center"
          >
            <p className={cn('text-2xl font-bold', stat.colour)}>{stat.value}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 bg-white/5 border-white/10 text-sm">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 bg-white/5 border-white/10 text-sm">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="title-tag">Title Tag</SelectItem>
              <SelectItem value="meta-description">Meta Description</SelectItem>
              <SelectItem value="h1">H1 Heading</SelectItem>
              <SelectItem value="schema">Schema Markup</SelectItem>
              <SelectItem value="content-structure">Content Structure</SelectItem>
              <SelectItem value="internal-links">Internal Links</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn('w-4 h-4 mr-1', isLoading && 'animate-spin')}
            />
            Refresh
          </Button>
        </div>

        <Button
          onClick={() => setWizardOpen(true)}
          className="gradient-primary text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Experiment
        </Button>
      </div>

      {/* Experiment grid */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : experiments.length === 0 ? (
        <div className="text-center py-16 border border-white/10 rounded-xl bg-white/[0.02]">
          <Beaker className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            No experiments yet
          </h3>
          <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
            Create your first SEO A/B experiment to start measuring what
            actually moves the needle on GEO, E-E-A-T, and rankings.
          </p>
          <Button
            onClick={() => setWizardOpen(true)}
            className="gradient-primary text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create First Experiment
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {experiments.map((experiment) => (
            <ExperimentCard
              key={experiment.id}
              experiment={experiment}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      )}

      {/* Wizard dialog */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="bg-gray-900 border border-white/10 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Beaker className="w-5 h-5 text-cyan-400" />
              New SEO Experiment
            </DialogTitle>
          </DialogHeader>
          <ExperimentWizard
            onCreated={handleWizardCreated}
            onClose={() => setWizardOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

function ExperimentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    tabParam && ['experiments', 'healing', 'dogfood'].includes(tabParam)
      ? tabParam
      : 'experiments'
  );

  function handleTabChange(tab: TabId) {
    setActiveTab(tab);
    router.replace(`/dashboard/experiments${tab !== 'experiments' ? `?tab=${tab}` : ''}`, {
      scroll: false,
    });
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Beaker className="w-6 h-6 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">Experiments</h1>
            <Badge className="bg-cyan-500/20 text-cyan-400 text-xs">Phase 98</Badge>
          </div>
          <p className="text-sm text-gray-400">
            Autonomous A/B testing, self-healing SEO, and dog-food checks
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.label.split('-')[0]}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'experiments' && <ExperimentsTab />}
      {activeTab === 'healing' && <HealingPanel />}
      {activeTab === 'dogfood' && <DogfoodScorecard />}

      {/* Best practices footer */}
      {activeTab === 'experiments' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {[
            {
              title: 'One variable at a time',
              body: 'Isolate changes to understand what actually drives improvement.',
              colour: 'bg-blue-500/10 border-blue-500/20',
            },
            {
              title: 'Set a clear hypothesis',
              body: 'Define what metric you expect to improve and by how much.',
              colour: 'bg-cyan-500/10 border-cyan-500/20',
            },
            {
              title: 'Wait for meaningful data',
              body: 'Run experiments for at least 14 days before drawing conclusions.',
              colour: 'bg-green-500/10 border-green-500/20',
            },
            {
              title: 'Apply winners immediately',
              body: 'Once a winner is identified, apply the change and move to the next test.',
              colour: 'bg-amber-500/10 border-amber-500/20',
            },
          ].map((tip) => (
            <div
              key={tip.title}
              className={cn('p-4 rounded-lg border', tip.colour)}
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">{tip.title}</p>
                  <p className="text-xs text-gray-400 mt-1">{tip.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExperimentsPage() {
  return (
    <Suspense>
      <ExperimentsPageContent />
    </Suspense>
  );
}
