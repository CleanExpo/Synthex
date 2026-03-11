'use client';

/**
 * AwardCard — Displays a single award listing (Phase 94)
 *
 * Shows award name, organiser, category, status badge, deadline countdown,
 * priority indicator, and action buttons.
 *
 * @module components/awards/AwardCard
 */

import { useState } from 'react';
import { Calendar, ExternalLink, Sparkles, Trash2, Edit } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { AwardStatus, AwardPriority } from '@/lib/awards/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AwardCardProps {
  id: string;
  name: string;
  organizer: string;
  category: string;
  status: AwardStatus;
  priority: AwardPriority;
  deadline?: string | null;
  submissionUrl?: string | null;
  entryFee?: string | null;
  isRecurring?: boolean;
  nominationDraft?: string | null;
  onGenerateNomination: (id: string) => void;
  onStatusChange: (id: string, status: AwardStatus) => void;
  onDelete: (id: string) => void;
}

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AwardStatus, { label: string; className: string }> = {
  researched:    { label: 'Researched',    className: 'bg-slate-700/60 text-slate-300' },
  'in-progress': { label: 'In Progress',  className: 'bg-blue-900/60 text-blue-300' },
  submitted:     { label: 'Submitted',    className: 'bg-yellow-900/60 text-yellow-300' },
  won:           { label: 'Won',          className: 'bg-emerald-900/60 text-emerald-300' },
  shortlisted:   { label: 'Shortlisted',  className: 'bg-purple-900/60 text-purple-300' },
  'not-selected':{ label: 'Not Selected', className: 'bg-red-900/60 text-red-400' },
};

const PRIORITY_DOT: Record<AwardPriority, string> = {
  low:    'bg-slate-400',
  medium: 'bg-yellow-400',
  high:   'bg-red-400',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysUntil(deadline: string): number {
  const now = new Date();
  const dl  = new Date(deadline);
  return Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const days = getDaysUntil(deadline);
  const dateStr = new Date(deadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

  if (days < 0) {
    return (
      <span className="text-xs text-slate-500 flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        Passed — {dateStr}
      </span>
    );
  }

  const colour =
    days < 7   ? 'text-red-400' :
    days < 30  ? 'text-yellow-400' :
                 'text-emerald-400';

  return (
    <span className={cn('text-xs flex items-center gap-1', colour)}>
      <Calendar className="h-3 w-3" />
      {days === 0 ? 'Due today' : `${days}d — ${dateStr}`}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AwardCard({
  id,
  name,
  organizer,
  category,
  status,
  priority,
  deadline,
  submissionUrl,
  entryFee,
  isRecurring,
  nominationDraft,
  onGenerateNomination,
  onStatusChange,
  onDelete,
}: AwardCardProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusCfg = STATUS_CONFIG[status];

  return (
    <div className="group rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 hover:bg-white/[0.07] transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Priority dot */}
            <span className={cn('inline-block h-2 w-2 rounded-full flex-shrink-0', PRIORITY_DOT[priority])} title={`Priority: ${priority}`} />
            <h3 className="font-medium text-sm text-white truncate">{name}</h3>
          </div>
          <p className="text-xs text-slate-400 truncate">{organizer}</p>
          <p className="text-xs text-slate-500 truncate mt-0.5">{category}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {submissionUrl && (
            <a
              href={submissionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Open submission URL"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            onClick={() => onDelete(id)}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
            title="Delete award"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        {/* Status badge — clickable */}
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusCfg.className)}
          >
            {statusCfg.label}
          </button>
          {showStatusMenu && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-slate-900 border border-white/10 rounded-lg shadow-xl py-1 w-36">
              {(Object.keys(STATUS_CONFIG) as AwardStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => { onStatusChange(id, s); setShowStatusMenu(false); }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs hover:bg-white/5',
                    s === status ? 'text-white' : 'text-slate-400'
                  )}
                >
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          )}
        </div>

        {entryFee && (
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full',
            entryFee === 'Free' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-slate-700/60 text-slate-400'
          )}>
            {entryFee}
          </span>
        )}

        {isRecurring && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/40 text-slate-400">Annual</span>
        )}
      </div>

      {/* Deadline */}
      {deadline && (
        <div className="mb-3">
          <DeadlineBadge deadline={deadline} />
        </div>
      )}

      {/* Generate Nomination button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onGenerateNomination(id)}
          className={cn(
            'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
            nominationDraft
              ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
              : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600/60'
          )}
        >
          <Sparkles className="h-3 w-3" />
          {nominationDraft ? 'View / Regenerate' : 'Generate Nomination'}
        </button>
      </div>
    </div>
  );
}
