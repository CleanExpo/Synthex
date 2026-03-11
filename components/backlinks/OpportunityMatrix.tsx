'use client';

/**
 * OpportunityMatrix — Matrix grid of prospects by type × DA tier (Phase 95)
 *
 * X-axis: opportunity types
 * Y-axis: domain authority tiers (High ≥70 / Medium 40-69 / Low <40)
 * Click a cell to filter the prospect list.
 *
 * @module components/backlinks/OpportunityMatrix
 */

import { cn } from '@/lib/utils';
import type { BacklinkOpportunityType, DomainAuthorityTier, MatrixFilter } from '@/lib/backlinks/types';
import type { ProspectCardData } from './BacklinkProspectCard';

// ─── Config ─────────────────────────────────────────────────────────────────

const TYPES: BacklinkOpportunityType[] = [
  'resource-page',
  'guest-post',
  'broken-link',
  'competitor-link',
  'journalist-mention',
];

const TYPE_SHORT_LABELS: Record<BacklinkOpportunityType, string> = {
  'resource-page':      'Resource',
  'guest-post':         'Guest Post',
  'broken-link':        'Broken Link',
  'competitor-link':    'Competitor',
  'journalist-mention': 'Journalist',
};

const TIERS: { tier: DomainAuthorityTier; label: string; range: string }[] = [
  { tier: 'high',   label: 'High DA',   range: '70+' },
  { tier: 'medium', label: 'Medium DA', range: '40–69' },
  { tier: 'low',    label: 'Low DA',    range: '<40' },
];

const TIER_COLOURS: Record<DomainAuthorityTier, string> = {
  high:   'text-emerald-400',
  medium: 'text-amber-400',
  low:    'text-slate-400',
};

// ─── Props ───────────────────────────────────────────────────────────────────

export interface OpportunityMatrixProps {
  prospects: ProspectCardData[];
  onFilterChange: (filter: MatrixFilter | null) => void;
  activeFilter: MatrixFilter | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDA(prospect: ProspectCardData): number {
  return prospect.domainAuthority ?? 0;
}

function getTier(da: number): DomainAuthorityTier {
  if (da >= 70) return 'high';
  if (da >= 40) return 'medium';
  return 'low';
}

function countCell(
  prospects: ProspectCardData[],
  type: BacklinkOpportunityType,
  tier: DomainAuthorityTier
): number {
  return prospects.filter(
    p => p.opportunityType === type && getTier(getDA(p)) === tier
  ).length;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OpportunityMatrix({
  prospects,
  onFilterChange,
  activeFilter,
}: OpportunityMatrixProps) {
  function handleCellClick(type: BacklinkOpportunityType, tier: DomainAuthorityTier) {
    // Toggle: click same cell = clear filter
    if (activeFilter?.opportunityType === type && activeFilter?.tier === tier) {
      onFilterChange(null);
    } else {
      onFilterChange({ opportunityType: type, tier });
    }
  }

  if (prospects.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-white mb-3">
        Opportunity Matrix
        <span className="ml-2 text-xs font-normal text-slate-400">Click a cell to filter</span>
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left pr-3 pb-2 text-slate-500 font-medium w-24">DA Tier</th>
              {TYPES.map(type => (
                <th key={type} className="pb-2 text-center text-slate-400 font-medium px-2">
                  {TYPE_SHORT_LABELS[type]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIERS.map(({ tier, label, range }) => (
              <tr key={tier}>
                <td className="py-1.5 pr-3 text-left">
                  <div className={cn('font-medium', TIER_COLOURS[tier])}>{label}</div>
                  <div className="text-slate-600">{range}</div>
                </td>
                {TYPES.map(type => {
                  const count = countCell(prospects, type, tier);
                  const isActive = activeFilter?.opportunityType === type && activeFilter?.tier === tier;
                  const isHighlighted = count >= 3;

                  return (
                    <td key={type} className="py-1.5 px-2 text-center">
                      <button
                        onClick={() => handleCellClick(type, tier)}
                        disabled={count === 0}
                        className={cn(
                          'w-10 h-9 rounded-lg text-sm font-semibold transition-all',
                          count === 0
                            ? 'text-slate-700 cursor-default'
                            : isActive
                              ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                              : isHighlighted
                                ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/40 hover:bg-emerald-900/70'
                                : 'bg-white/8 text-slate-300 border border-white/10 hover:bg-white/15'
                        )}
                      >
                        {count > 0 ? count : '—'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeFilter && (
        <button
          onClick={() => onFilterChange(null)}
          className="mt-2 text-xs text-slate-400 hover:text-slate-200 underline"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}
