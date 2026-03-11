'use client';

/**
 * DirectoryTemplateGrid — Browse curated directory templates (Phase 94)
 *
 * Displays the DIRECTORY_TEMPLATES list fetched from /api/directories/templates.
 * Click-to-add immediately submits the directory to the tracker.
 *
 * @module components/awards/DirectoryTemplateGrid
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Plus, Sparkles } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { DirectoryTemplate } from '@/lib/awards/directory-database';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

export interface DirectoryTemplateGridProps {
  addedIds?: Set<string>;       // directoryUrls already added
  onAdd: (template: DirectoryTemplate) => void;
}

export function DirectoryTemplateGrid({ addedIds = new Set(), onAdd }: DirectoryTemplateGridProps) {
  const [aiOnly, setAiOnly]   = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);

  const params = new URLSearchParams();
  if (aiOnly)   params.set('isAiIndexed', 'true');
  if (freeOnly) params.set('isFree', 'true');

  const { data, isLoading } = useSWR<{ templates: DirectoryTemplate[] }>(
    `/api/directories/templates?${params}`,
    fetchJson,
    { revalidateOnFocus: false }
  );

  const templates = data?.templates ?? [];

  return (
    <div>
      {/* Filter buttons */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setAiOnly(!aiOnly)}
          className={cn(
            'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5',
            aiOnly
              ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40'
              : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'
          )}
        >
          <Sparkles className="h-3 w-3" />
          AI Indexed
        </button>
        <button
          onClick={() => setFreeOnly(!freeOnly)}
          className={cn(
            'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
            freeOnly
              ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
              : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'
          )}
        >
          Free Only
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">No directories found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {templates.map((t, i) => {
            const alreadyAdded = addedIds.has(t.directoryUrl);
            return (
              <div
                key={i}
                className={cn(
                  'group rounded-xl border border-white/10 bg-white/5 p-4 transition-all',
                  alreadyAdded
                    ? 'opacity-50 cursor-default'
                    : 'hover:bg-white/[0.07] cursor-pointer'
                )}
                onClick={() => !alreadyAdded && onAdd(t)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-white truncate">{t.directoryName}</h4>
                    <p className="text-xs text-slate-400 truncate">{t.category}</p>
                  </div>
                  {alreadyAdded ? (
                    <span className="text-xs text-emerald-400 flex-shrink-0">Added</span>
                  ) : (
                    <Plus className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 transition-colors flex-shrink-0 mt-0.5" />
                  )}
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 mb-2">{t.description}</p>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 font-mono">DA {t.domainAuthority}</span>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    t.isFree ? 'bg-emerald-900/40 text-emerald-400' : 'bg-slate-700/60 text-slate-400'
                  )}>
                    {t.isFree ? 'Free' : 'Paid'}
                  </span>
                  {t.isAiIndexed && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      AI Indexed
                    </span>
                  )}
                  <span className="text-xs text-slate-600">{t.country}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
