'use client';

/**
 * Algorithm Update Timeline Component
 *
 * Displays a vertical timeline of Google algorithm updates with:
 * - Date + update name + impact badge
 * - "Active rollout" indicator if rolloutEnd is null/future
 * - Correlation chip if user had traffic drop during this update period
 */

import type { SiteHealthSnapshot } from '@prisma/client';

interface AlgorithmUpdate {
  id: string;
  name: string;
  updateType: string;
  announcedAt: string;
  rolloutStart: string | null;
  rolloutEnd: string | null;
  impactLevel: string;
  description: string;
  sourceUrl: string | null;
}

interface AlgorithmUpdateTimelineProps {
  updates: AlgorithmUpdate[];
  snapshots?: Array<{ date: string; totalClicks: number }>;
  loading?: boolean;
}

const IMPACT_CONFIG = {
  high: { dot: 'bg-red-500', badge: 'bg-red-500/20 text-red-300', label: 'High Impact' },
  medium: { dot: 'bg-amber-500', badge: 'bg-amber-500/20 text-amber-300', label: 'Medium Impact' },
  low: { dot: 'bg-gray-500', badge: 'bg-gray-500/20 text-gray-300', label: 'Low Impact' },
} as const;

const UPDATE_TYPE_LABELS: Record<string, string> = {
  core: 'Core Update',
  spam: 'Spam Update',
  'helpful-content': 'Helpful Content',
  'product-reviews': 'Product Reviews',
  'link-spam': 'Link Spam',
  other: 'Update',
};

function isActiveRollout(update: AlgorithmUpdate): boolean {
  const now = new Date();
  if (!update.rolloutStart) return false;
  const start = new Date(update.rolloutStart);
  if (start > now) return false;
  if (!update.rolloutEnd) return true; // Ongoing
  return new Date(update.rolloutEnd) > now;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Check if user's traffic dropped during the update window.
 * Returns the percentage drop if correlated, otherwise null.
 */
function detectCorrelation(
  update: AlgorithmUpdate,
  snapshots: Array<{ date: string; totalClicks: number }> | undefined
): number | null {
  if (!snapshots || snapshots.length < 2) return null;
  const start = new Date(update.announcedAt);
  const end = update.rolloutEnd ? new Date(update.rolloutEnd) : new Date();

  // Find snapshots before and during the update window
  const before = snapshots.filter((s) => new Date(s.date) < start);
  const during = snapshots.filter((s) => {
    const d = new Date(s.date);
    return d >= start && d <= end;
  });

  if (before.length === 0 || during.length === 0) return null;

  const avgBefore = before.reduce((s, p) => s + p.totalClicks, 0) / before.length;
  const avgDuring = during.reduce((s, p) => s + p.totalClicks, 0) / during.length;

  if (avgBefore === 0) return null;
  const changePct = ((avgDuring - avgBefore) / avgBefore) * 100;

  // Only flag if >20% drop
  return changePct < -20 ? changePct : null;
}

export function AlgorithmUpdateTimeline({
  updates,
  snapshots,
  loading = false,
}: AlgorithmUpdateTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="w-3 h-3 mt-1.5 rounded-full bg-white/10 flex-shrink-0" />
            <div className="flex-1 h-20 rounded-lg bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500 text-sm">
        No algorithm updates found for the selected period.
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[5px] top-3 bottom-3 w-px bg-white/10" />

      <div className="space-y-6">
        {updates.map((update) => {
          const config =
            IMPACT_CONFIG[update.impactLevel as keyof typeof IMPACT_CONFIG] ?? IMPACT_CONFIG.low;
          const active = isActiveRollout(update);
          const typeLabel = UPDATE_TYPE_LABELS[update.updateType] ?? 'Update';
          const correlation = detectCorrelation(update, snapshots);

          return (
            <div key={update.id} className="flex gap-4">
              {/* Timeline dot */}
              <div className="relative flex-shrink-0 mt-1.5">
                <div className={`w-3 h-3 rounded-full border-2 border-[#0f1117] ${config.dot}`} />
                {active && (
                  <div className={`absolute inset-0 rounded-full ${config.dot} animate-ping opacity-40`} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                {/* Date */}
                <div className="text-xs text-gray-500 mb-1">
                  {formatDateShort(update.announcedAt)}
                  {update.rolloutEnd
                    ? ` — ${formatDateShort(update.rolloutEnd)}`
                    : ' — ongoing'}
                </div>

                {/* Name + badges */}
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-medium text-white text-sm">{update.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-300">
                    {typeLabel}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${config.badge}`}>
                    {config.label}
                  </span>
                  {active && (
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active rollout
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-gray-400 leading-relaxed">{update.description}</p>

                {/* Correlation chip */}
                {correlation !== null && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    <span>⚠</span>
                    <span>
                      Traffic dropped {Math.abs(correlation).toFixed(0)}% during this update
                    </span>
                  </div>
                )}

                {/* Source link */}
                {update.sourceUrl && (
                  <a
                    href={update.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Google Search Central →
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
