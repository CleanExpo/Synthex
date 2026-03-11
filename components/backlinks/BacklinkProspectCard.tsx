'use client';

/**
 * BacklinkProspectCard — Displays a single backlink prospect (Phase 95)
 *
 * Shows domain, opportunity type badge, domain authority score,
 * status badge, and action buttons.
 *
 * @module components/backlinks/BacklinkProspectCard
 */

import { ExternalLink, Mail, CheckCircle } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { BacklinkOpportunityType, BacklinkStatus } from '@/lib/backlinks/types';
import { OPPORTUNITY_TYPE_LABELS } from '@/lib/backlinks/outreach-templates';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ProspectCardData {
  id: string;
  targetUrl: string;
  targetDomain: string;
  domainAuthority: number | null;
  pageRank: number | null;
  opportunityType: string;
  status: string;
  pitchSent: boolean;
  discoveredAt: string;
  contactedAt?: string | null;
  publishedAt?: string | null;
  outreachEmail?: string | null;
  notes?: string | null;
}

export interface BacklinkProspectCardProps {
  prospect: ProspectCardData;
  onOutreach: (id: string) => void;
  onMarkPublished: (id: string) => void;
}

// ─── Badge configs ──────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<BacklinkOpportunityType, { label: string; className: string }> = {
  'resource-page':      { label: 'Resource Page',      className: 'bg-blue-900/60 text-blue-300 border border-blue-700/40' },
  'guest-post':         { label: 'Guest Post',         className: 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/40' },
  'broken-link':        { label: 'Broken Link',        className: 'bg-amber-900/60 text-amber-300 border border-amber-700/40' },
  'competitor-link':    { label: 'Competitor Link',    className: 'bg-purple-900/60 text-purple-300 border border-purple-700/40' },
  'journalist-mention': { label: 'Journalist Mention', className: 'bg-cyan-900/60 text-cyan-300 border border-cyan-700/40' },
};

const STATUS_CONFIG: Record<BacklinkStatus, { label: string; className: string }> = {
  identified: { label: 'Identified', className: 'bg-slate-700/60 text-slate-300' },
  contacted:  { label: 'Contacted',  className: 'bg-blue-900/60 text-blue-300' },
  published:  { label: 'Published',  className: 'bg-emerald-900/60 text-emerald-300' },
  rejected:   { label: 'Rejected',   className: 'bg-red-900/60 text-red-400' },
};

// ─── DA colour coding ───────────────────────────────────────────────────────

function getDaColour(da: number | null): string {
  if (da === null) return 'text-slate-400';
  if (da >= 70) return 'text-emerald-400';
  if (da >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function getDaLabel(da: number | null): string {
  if (da === null) return '—';
  if (da >= 70) return 'High Authority';
  if (da >= 40) return 'Medium Authority';
  return 'Low Authority';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function truncateUrl(url: string, maxLen = 55): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen) + '…';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BacklinkProspectCard({
  prospect,
  onOutreach,
  onMarkPublished,
}: BacklinkProspectCardProps) {
  const typeKey  = prospect.opportunityType as BacklinkOpportunityType;
  const statusKey = prospect.status as BacklinkStatus;
  const typeConf  = TYPE_CONFIG[typeKey]  ?? { label: OPPORTUNITY_TYPE_LABELS[typeKey] ?? prospect.opportunityType, className: 'bg-slate-700/60 text-slate-300' };
  const statusConf = STATUS_CONFIG[statusKey] ?? { label: prospect.status, className: 'bg-slate-700/60 text-slate-300' };
  const da = prospect.domainAuthority;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/8 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-white truncate">{prospect.targetDomain}</span>
            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', typeConf.className)}>
              {typeConf.label}
            </span>
            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusConf.className)}>
              {statusConf.label}
            </span>
          </div>
          <a
            href={prospect.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{truncateUrl(prospect.targetUrl)}</span>
          </a>
        </div>

        {/* Domain Authority */}
        <div className="text-right shrink-0">
          <div className={cn('text-2xl font-bold tabular-nums', getDaColour(da))}>
            {da ?? '—'}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{getDaLabel(da)}</div>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
        <span>Found {formatDate(prospect.discoveredAt)}</span>
        {prospect.contactedAt && (
          <>
            <span>·</span>
            <span>Contacted {formatDate(prospect.contactedAt)}</span>
          </>
        )}
        {prospect.publishedAt && (
          <>
            <span>·</span>
            <span className="text-emerald-400">Published {formatDate(prospect.publishedAt)}</span>
          </>
        )}
      </div>

      {/* Notes */}
      {prospect.notes && (
        <p className="text-xs text-slate-400 mb-3 line-clamp-2">{prospect.notes}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onOutreach(prospect.id)}
          disabled={prospect.status === 'published' || prospect.status === 'rejected'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-900/40 text-blue-300 border border-blue-700/40 hover:bg-blue-900/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Mail className="h-3.5 w-3.5" />
          {prospect.pitchSent ? 'Edit Outreach' : 'Create Outreach'}
        </button>

        {prospect.status === 'contacted' && (
          <button
            onClick={() => onMarkPublished(prospect.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-900/40 text-emerald-300 border border-emerald-700/40 hover:bg-emerald-900/70 transition-colors"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Mark Published
          </button>
        )}
      </div>
    </div>
  );
}
