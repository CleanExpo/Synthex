'use client';

/**
 * AwardTemplateGrid — Browse curated award templates (Phase 94)
 *
 * Displays the AWARD_TEMPLATES list fetched from /api/awards/templates.
 * Click-to-add pre-fills the award creation form.
 *
 * @module components/awards/AwardTemplateGrid
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Plus, Award } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { AwardTemplate } from '@/lib/awards/award-database';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

export interface AwardTemplateGridProps {
  onSelect: (template: AwardTemplate) => void;
}

export function AwardTemplateGrid({ onSelect }: AwardTemplateGridProps) {
  const [country, setCountry] = useState<'Australia' | 'Global' | 'all'>('all');

  const params = new URLSearchParams();
  if (country !== 'all') params.set('country', country);

  const { data, isLoading } = useSWR<{ templates: AwardTemplate[] }>(
    `/api/awards/templates?${params}`,
    fetchJson,
    { revalidateOnFocus: false }
  );

  const templates = data?.templates ?? [];

  return (
    <div>
      {/* Filter buttons */}
      <div className="flex items-center gap-2 mb-4">
        {(['all', 'Australia', 'Global'] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCountry(c)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
              country === c
                ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'
            )}
          >
            {c === 'all' ? 'All' : c}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">No award templates found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {templates.map((t, i) => (
            <div
              key={i}
              className="group rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/[0.07] transition-all cursor-pointer"
              onClick={() => onSelect(t)}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-white truncate">{t.name}</h4>
                  <p className="text-xs text-slate-400 truncate">{t.organizer}</p>
                </div>
                <Plus className="h-4 w-4 text-slate-500 group-hover:text-purple-400 transition-colors flex-shrink-0 mt-0.5" />
              </div>

              <p className="text-xs text-slate-500 line-clamp-2 mb-2">{t.description}</p>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400">{t.country}</span>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  t.entryFee === 'Free'
                    ? 'bg-emerald-900/40 text-emerald-400'
                    : 'bg-slate-700/60 text-slate-400'
                )}>
                  {t.entryFee}
                </span>
                <span className="text-xs text-slate-500 truncate">{t.typicalDeadline}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
