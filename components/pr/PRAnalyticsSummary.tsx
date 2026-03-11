'use client';

/**
 * PR Analytics Summary (Phase 93)
 *
 * Stat cards showing a breakdown of press release statuses.
 * Rendered at the top of the Press Releases tab.
 *
 * @module components/pr/PRAnalyticsSummary
 */

import { FileText, CheckCircle, Archive, Edit3 } from '@/components/icons';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PRAnalyticsSummaryProps {
  releases: Array<{ id: string; status: string }>;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  colour: string;
  isLoading?: boolean;
}

function StatCard({ label, value, icon, colour, isLoading }: StatCardProps) {
  return (
    <div className={cn(
      'rounded-xl border bg-white/[0.02] p-4 flex items-center gap-3',
      colour === 'cyan'   && 'border-cyan-500/20',
      colour === 'green'  && 'border-green-500/20',
      colour === 'gray'   && 'border-white/[0.06]',
      colour === 'amber'  && 'border-amber-500/20',
    )}>
      <div className={cn(
        'p-2 rounded-lg',
        colour === 'cyan'  && 'bg-cyan-500/10 text-cyan-400',
        colour === 'green' && 'bg-green-500/10 text-green-400',
        colour === 'gray'  && 'bg-white/[0.04] text-gray-400',
        colour === 'amber' && 'bg-amber-500/10 text-amber-400',
      )}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        {isLoading ? (
          <div className="h-5 w-8 bg-white/[0.06] animate-pulse rounded mt-0.5" />
        ) : (
          <p className="text-xl font-bold text-white">{value}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PRAnalyticsSummary({ releases, isLoading }: PRAnalyticsSummaryProps) {
  const total     = releases.length;
  const published = releases.filter((r) => r.status === 'published').length;
  const draft     = releases.filter((r) => r.status === 'draft').length;
  const archived  = releases.filter((r) => r.status === 'archived').length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      <StatCard
        label="Total"
        value={total}
        icon={<FileText className="h-4 w-4" />}
        colour="cyan"
        isLoading={isLoading}
      />
      <StatCard
        label="Published"
        value={published}
        icon={<CheckCircle className="h-4 w-4" />}
        colour="green"
        isLoading={isLoading}
      />
      <StatCard
        label="Drafts"
        value={draft}
        icon={<Edit3 className="h-4 w-4" />}
        colour="amber"
        isLoading={isLoading}
      />
      <StatCard
        label="Archived"
        value={archived}
        icon={<Archive className="h-4 w-4" />}
        colour="gray"
        isLoading={isLoading}
      />
    </div>
  );
}
