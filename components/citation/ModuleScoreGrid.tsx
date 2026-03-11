'use client';

/**
 * ModuleScoreGrid — Phase 99
 *
 * Status grid showing all v5.0 AI-Native GEO & Citation Engine modules.
 * Each card shows the module name, a score or count, an active/inactive
 * status indicator, and a link to the relevant dashboard page.
 */

import Link from 'next/link';
import type { OverviewStats } from '@/lib/citation/aggregator';

interface ModuleScoreGridProps {
  overview: OverviewStats | undefined;
  loading?: boolean;
}

interface ModuleConfig {
  label: string;
  href: string;
  getValue: (o: OverviewStats) => { display: string; numeric: number };
  description: string;
}

const MODULES: ModuleConfig[] = [
  {
    label: 'GEO Analysis',
    href: '/dashboard/geo',
    getValue: (o) => ({
      display: o.geoSummary.count > 0 ? `${o.geoSummary.avgScore}` : '—',
      numeric: o.geoSummary.avgScore,
    }),
    description: 'Avg GEO score',
  },
  {
    label: 'Entity Coherence',
    href: '/dashboard/geo',
    getValue: (o) => ({
      display:
        o.entitySummary.avgCoherenceScore > 0
          ? `${o.entitySummary.avgCoherenceScore}`
          : '—',
      numeric: o.entitySummary.avgCoherenceScore,
    }),
    description: 'Avg coherence',
  },
  {
    label: 'Authority Engine',
    href: '/dashboard/authority',
    getValue: (o) => ({
      display: o.geoSummary.count > 0 ? `${o.geoSummary.avgScore}` : '—',
      numeric: o.geoSummary.avgScore,
    }),
    description: 'Avg authority',
  },
  {
    label: 'Writing Quality',
    href: '/dashboard/quality',
    getValue: (o) => ({
      display:
        o.qualitySummary.avgQualityScore > 0
          ? `${o.qualitySummary.avgQualityScore}`
          : '—',
      numeric: o.qualitySummary.avgQualityScore,
    }),
    description: 'Avg humaness score',
  },
  {
    label: 'AI Slop Detection',
    href: '/dashboard/quality',
    getValue: (o) => ({
      display:
        o.qualitySummary.auditsRun > 0
          ? `${o.qualitySummary.auditsRun} audits`
          : '—',
      numeric: o.qualitySummary.auditsRun,
    }),
    description: 'Audits completed',
  },
  {
    label: 'E-E-A-T Builder',
    href: '/dashboard/eeat',
    getValue: (o) => ({
      display:
        o.qualitySummary.avgEeatScore > 0
          ? `${o.qualitySummary.avgEeatScore}`
          : '—',
      numeric: o.qualitySummary.avgEeatScore,
    }),
    description: 'Avg E-E-A-T score',
  },
  {
    label: 'Brand Builder',
    href: '/dashboard/brand',
    getValue: (o) => ({
      display:
        o.entitySummary.profilesCreated > 0
          ? `${o.entitySummary.profilesCreated} profiles`
          : '—',
      numeric: o.entitySummary.profilesCreated,
    }),
    description: 'Brand profiles',
  },
  {
    label: 'PR Manager',
    href: '/dashboard/pr',
    getValue: (o) => ({
      display:
        o.backlinkSummary.contacted > 0
          ? `${o.backlinkSummary.contacted} pitched`
          : '—',
      numeric: o.backlinkSummary.contacted,
    }),
    description: 'Outreach sent',
  },
  {
    label: 'Backlink Prospector',
    href: '/dashboard/backlinks',
    getValue: (o) => ({
      display:
        o.backlinkSummary.prospectsFound > 0
          ? `${o.backlinkSummary.prospectsFound} found`
          : '—',
      numeric: o.backlinkSummary.prospectsFound,
    }),
    description: 'Prospects discovered',
  },
  {
    label: 'Prompt Intelligence',
    href: '/dashboard/prompts',
    getValue: (o) => ({
      display:
        o.promptSummary.tracked > 0
          ? `${o.promptSummary.coverageRate}%`
          : '—',
      numeric: o.promptSummary.coverageRate,
    }),
    description: 'AI mention rate',
  },
  {
    label: 'Algorithm Sentinel',
    href: '/dashboard/sentinel',
    getValue: (o) => ({
      display:
        o.alertsSummary.recent7Days > 0
          ? `${o.alertsSummary.recent7Days} alerts`
          : 'All clear',
      numeric: o.alertsSummary.recent7Days,
    }),
    description: 'Alerts (7 days)',
  },
];

function ScoreColour(numeric: number, module: string): string {
  // Sentinel: lower is better
  if (module === 'Algorithm Sentinel') {
    if (numeric === 0) return 'text-emerald-400';
    if (numeric <= 3) return 'text-amber-400';
    return 'text-red-400';
  }
  // Count modules
  if (['Brand Builder', 'PR Manager', 'Backlink Prospector', 'AI Slop Detection'].includes(module)) {
    return numeric > 0 ? 'text-cyan-400' : 'text-gray-500';
  }
  // Score modules
  if (numeric >= 80) return 'text-emerald-400';
  if (numeric >= 60) return 'text-cyan-400';
  if (numeric >= 40) return 'text-amber-400';
  if (numeric > 0) return 'text-red-400';
  return 'text-gray-500';
}

function StatusDot({ active }: { active: boolean }) {
  if (active) {
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
    );
  }
  return <span className="inline-flex rounded-full h-2 w-2 bg-gray-600" />;
}

export function ModuleScoreGrid({ overview, loading = false }: ModuleScoreGridProps) {
  if (loading || !overview) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {MODULES.map((m) => (
          <div
            key={m.label}
            className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 animate-pulse"
          >
            <div className="h-3 bg-white/5 rounded w-2/3 mb-2" />
            <div className="h-6 bg-white/5 rounded w-1/2 mb-1" />
            <div className="h-2.5 bg-white/5 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {MODULES.map((module) => {
        const { display, numeric } = module.getValue(overview);
        const hasData = numeric > 0 || display === 'All clear';
        const scoreColour = ScoreColour(numeric, module.label);

        return (
          <Link
            key={module.label}
            href={module.href}
            className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 hover:bg-white/[0.04] hover:border-white/[0.10] transition-all group"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-400 group-hover:text-gray-300 transition-colors truncate pr-2">
                {module.label}
              </span>
              <StatusDot active={hasData} />
            </div>

            {/* Score */}
            <div className={`text-xl font-bold mb-1 ${scoreColour}`}>
              {display}
            </div>

            {/* Description */}
            <p className="text-xs text-gray-600">{module.description}</p>
          </Link>
        );
      })}
    </div>
  );
}
