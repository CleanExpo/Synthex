'use client';

/**
 * PR Journalist CRM — Journalist List Component (Phase 92)
 *
 * Searchable list with tier badges, beat chips, and Hunter.io enrichment.
 *
 * @module components/pr/JournalistList
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Search, Loader2, AlertCircle, AtSign } from '@/components/icons';
import { JournalistForm } from './JournalistForm';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Journalist {
  id: string;
  name: string;
  email?: string | null;
  emailVerified: boolean;
  outlet: string;
  outletDomain: string;
  title?: string | null;
  beats: string[];
  tier: string;
  lastContactedAt?: string | null;
  _count: { pitches: number };
}

interface JournalistsResponse {
  contacts: Journalist[];
}

// ---------------------------------------------------------------------------
// SWR fetcher
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIER_STYLES: Record<string, { label: string; className: string }> = {
  cold:     { label: 'Cold',     className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  warm:     { label: 'Warm',     className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  hot:      { label: 'Hot',      className: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  advocate: { label: 'Advocate', className: 'bg-green-500/20 text-green-300 border-green-500/30' },
};

function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface JournalistListProps {
  onSelectJournalist?: (id: string) => void;
}

export function JournalistList({ onSelectJournalist }: JournalistListProps) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  const { data, isLoading, error, mutate } = useSWR<JournalistsResponse>(
    '/api/pr/journalists',
    fetchJson
  );

  const contacts = data?.contacts ?? [];

  // Client-side search filter
  const filtered = contacts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.outlet.toLowerCase().includes(q) ||
      c.outletDomain.toLowerCase().includes(q) ||
      c.beats.some((b) => b.toLowerCase().includes(q))
    );
  });

  const handleEnrich = async (journalist: Journalist) => {
    setEnrichingId(journalist.id);
    try {
      await fetch(`/api/pr/journalists/${journalist.id}/enrich`, {
        method: 'POST',
        credentials: 'include',
      });
      await mutate();
    } finally {
      setEnrichingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading journalists...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 py-8">
        <AlertCircle className="h-5 w-5" />
        Failed to load journalists. Please try again.
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search journalists..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="ml-3 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Journalist
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {search ? 'No journalists match your search.' : 'No journalists yet. Add your first contact.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((journalist) => {
            const tier = TIER_STYLES[journalist.tier] ?? TIER_STYLES.cold;
            return (
              <div
                key={journalist.id}
                className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:bg-white/[0.08] transition-colors cursor-pointer"
                onClick={() => onSelectJournalist?.(journalist.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium truncate">{journalist.name}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border', tier.className)}>
                      {tier.label}
                    </span>
                    {journalist.email && (
                      <AtSign className="h-3 w-3 text-green-400 flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-sm text-gray-400 truncate">
                    {journalist.outlet} · {journalist.title ?? journalist.outletDomain}
                  </div>
                  {journalist.beats.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {journalist.beats.slice(0, 4).map((beat) => (
                        <span
                          key={beat}
                          className="text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-300 rounded border border-blue-500/20"
                        >
                          {beat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      {journalist._count.pitches} pitch{journalist._count.pitches !== 1 ? 'es' : ''}
                    </div>
                    <div className="text-xs text-gray-600">
                      {formatRelativeDate(journalist.lastContactedAt)}
                    </div>
                  </div>
                  {!journalist.email && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEnrich(journalist);
                      }}
                      disabled={enrichingId === journalist.id}
                      className="px-2 py-1 text-xs bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 transition-colors disabled:opacity-50"
                    >
                      {enrichingId === journalist.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        'Enrich'
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New journalist modal */}
      {showForm && (
        <JournalistForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            mutate();
          }}
        />
      )}
    </div>
  );
}
