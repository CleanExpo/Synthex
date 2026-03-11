'use client';

/**
 * SubmissionDeadlineList — Sorted list of upcoming award deadlines (Phase 94)
 *
 * Displays deadlines within 90 days with colour-coded urgency indicators.
 *
 * @module components/awards/SubmissionDeadlineList
 */

import { Calendar, Award } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { UpcomingDeadline, AwardPriority } from '@/lib/awards/types';

export interface SubmissionDeadlineListProps {
  deadlines: UpcomingDeadline[];
  isLoading?: boolean;
}

const PRIORITY_DOT: Record<AwardPriority, string> = {
  low:    'bg-slate-400',
  medium: 'bg-yellow-400',
  high:   'bg-red-400',
};

function urgencyClass(daysUntil: number): string {
  if (daysUntil < 7)  return 'text-red-400';
  if (daysUntil < 30) return 'text-yellow-400';
  return 'text-emerald-400';
}

function urgencyLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Due today';
  if (daysUntil < 0)   return 'Overdue';
  return `${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
}

export function SubmissionDeadlineList({ deadlines, isLoading = false }: SubmissionDeadlineListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (deadlines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Calendar className="h-10 w-10 text-slate-600 mb-3" />
        <p className="text-slate-400 text-sm font-medium">No upcoming deadlines</p>
        <p className="text-slate-600 text-xs mt-1">Award deadlines within the next 90 days will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {deadlines.map((dl) => (
        <div
          key={dl.id}
          className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/[0.07] transition-all"
        >
          {/* Icon */}
          <Award className="h-5 w-5 text-slate-500 flex-shrink-0" />

          {/* Name + date */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{dl.name}</p>
            <p className="text-xs text-slate-400">
              {new Date(dl.deadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* Priority dot */}
          <span className={cn('h-2 w-2 rounded-full flex-shrink-0', PRIORITY_DOT[dl.priority])} title={`Priority: ${dl.priority}`} />

          {/* Days counter */}
          <div className="text-right flex-shrink-0">
            <span className={cn('text-sm font-semibold tabular-nums', urgencyClass(dl.daysUntil))}>
              {urgencyLabel(dl.daysUntil)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
