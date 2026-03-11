'use client';

/**
 * DirectoryCard — Displays a single directory listing (Phase 94)
 *
 * Shows directory name, DA badge, AI-indexed indicator, status badge,
 * free/paid tag, and quick action buttons.
 *
 * @module components/awards/DirectoryCard
 */

import { useState } from 'react';
import { ExternalLink, Sparkles, Trash2 } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { DirectoryStatus } from '@/lib/awards/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DirectoryCardProps {
  id: string;
  directoryName: string;
  directoryUrl: string;
  listingUrl?: string | null;
  category?: string | null;
  status: DirectoryStatus;
  domainAuthority?: number | null;
  isFree: boolean;
  isAiIndexed: boolean;
  notes?: string | null;
  onStatusChange: (id: string, status: DirectoryStatus) => void;
  onDelete: (id: string) => void;
}

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DirectoryStatus, { label: string; className: string }> = {
  identified:    { label: 'Identified',    className: 'bg-slate-700/60 text-slate-300' },
  submitted:     { label: 'Submitted',     className: 'bg-blue-900/60 text-blue-300' },
  live:          { label: 'Live',          className: 'bg-emerald-900/60 text-emerald-300' },
  'needs-update':{ label: 'Needs Update',  className: 'bg-yellow-900/60 text-yellow-300' },
  rejected:      { label: 'Rejected',      className: 'bg-red-900/60 text-red-400' },
};

// ─── DA Badge ────────────────────────────────────────────────────────────────

function DABadge({ da }: { da: number }) {
  const colour =
    da >= 80 ? 'bg-emerald-900/60 text-emerald-300' :
    da >= 60 ? 'bg-blue-900/60 text-blue-300' :
    da >= 40 ? 'bg-yellow-900/60 text-yellow-300' :
               'bg-slate-700/60 text-slate-400';

  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-mono font-medium', colour)} title="Domain Authority">
      DA {da}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DirectoryCard({
  id,
  directoryName,
  directoryUrl,
  listingUrl,
  category,
  status,
  domainAuthority,
  isFree,
  isAiIndexed,
  onStatusChange,
  onDelete,
}: DirectoryCardProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusCfg = STATUS_CONFIG[status];
  const displayUrl = listingUrl ?? directoryUrl;

  return (
    <div className="group rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 hover:bg-white/[0.07] transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-white truncate mb-0.5">{directoryName}</h3>
          {category && <p className="text-xs text-slate-400 truncate">{category}</p>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title={listingUrl ? 'View listing' : 'Open directory'}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={() => onDelete(id)}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
            title="Delete directory"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status badge */}
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusCfg.className)}
          >
            {statusCfg.label}
          </button>
          {showStatusMenu && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-slate-900 border border-white/10 rounded-lg shadow-xl py-1 w-36">
              {(Object.keys(STATUS_CONFIG) as DirectoryStatus[]).map((s) => (
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

        {/* DA badge */}
        {domainAuthority != null && <DABadge da={domainAuthority} />}

        {/* Free/Paid */}
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full',
          isFree ? 'bg-emerald-900/40 text-emerald-400' : 'bg-slate-700/60 text-slate-400'
        )}>
          {isFree ? 'Free' : 'Paid'}
        </span>

        {/* AI Indexed */}
        {isAiIndexed && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            AI Indexed
          </span>
        )}
      </div>
    </div>
  );
}
