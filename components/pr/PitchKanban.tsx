'use client';

/**
 * PR Journalist CRM — Pitch Kanban Board (Phase 92)
 *
 * Status columns: draft | sent | opened | replied | covered | declined
 * Click-to-update-status (no drag required).
 *
 * @module components/pr/PitchKanban
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Loader2, AlertCircle, Send, Check } from '@/components/icons';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Pitch {
  id: string;
  subject: string;
  angle: string;
  status: string;
  createdAt: string;
  journalist: {
    id: string;
    name: string;
    outlet: string;
    tier: string;
  };
  _count: { coverage: number };
}

interface PitchesResponse {
  pitches: Pitch[];
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
// Constants
// ---------------------------------------------------------------------------

const STATUSES = [
  { key: 'draft',    label: 'Draft',    colour: 'border-gray-500/40 bg-gray-500/5' },
  { key: 'sent',     label: 'Sent',     colour: 'border-blue-500/40 bg-blue-500/5' },
  { key: 'opened',   label: 'Opened',   colour: 'border-purple-500/40 bg-purple-500/5' },
  { key: 'replied',  label: 'Replied',  colour: 'border-yellow-500/40 bg-yellow-500/5' },
  { key: 'covered',  label: 'Covered',  colour: 'border-green-500/40 bg-green-500/5' },
  { key: 'declined', label: 'Declined', colour: 'border-red-500/40 bg-red-500/5' },
] as const;

type PitchStatusKey = (typeof STATUSES)[number]['key'];

const STATUS_TRANSITIONS: Record<PitchStatusKey, PitchStatusKey[]> = {
  draft:    ['sent', 'archived'] as PitchStatusKey[],
  sent:     ['opened', 'replied', 'declined'] as PitchStatusKey[],
  opened:   ['replied', 'covered', 'declined'] as PitchStatusKey[],
  replied:  ['covered', 'declined'] as PitchStatusKey[],
  covered:  [] as PitchStatusKey[],
  declined: [] as PitchStatusKey[],
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });
}

// ---------------------------------------------------------------------------
// Pitch Card
// ---------------------------------------------------------------------------

interface PitchCardProps {
  pitch: Pitch;
  onStatusChange: (pitchId: string, newStatus: PitchStatusKey) => void;
  updating: string | null;
}

function PitchCard({ pitch, onStatusChange, updating }: PitchCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const currentStatus = pitch.status as PitchStatusKey;
  const transitions = STATUS_TRANSITIONS[currentStatus] ?? [];

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3 relative">
      <div className="text-sm font-medium text-white mb-1 line-clamp-2">{pitch.subject}</div>
      <div className="text-xs text-gray-400 mb-2 line-clamp-2">{pitch.angle}</div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-cyan-300 font-medium">{pitch.journalist.name}</div>
          <div className="text-xs text-gray-500">{pitch.journalist.outlet} · {formatDate(pitch.createdAt)}</div>
        </div>
        {transitions.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              disabled={updating === pitch.id}
              className="px-2 py-1 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 text-gray-300"
            >
              {updating === pitch.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Move →'}
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-gray-900 border border-white/10 rounded-lg shadow-xl min-w-[120px]">
                {transitions.map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setShowMenu(false);
                      onStatusChange(pitch.id, status);
                    }}
                    className="block w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    → {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {pitch._count.coverage > 0 && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <Check className="h-3 w-3" />
            {pitch._count.coverage} coverage
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface PitchKanbanProps {
  onNewPitch?: () => void;
}

export function PitchKanban({ onNewPitch }: PitchKanbanProps) {
  const [updating, setUpdating] = useState<string | null>(null);

  const { data, isLoading, error, mutate } = useSWR<PitchesResponse>(
    '/api/pr/pitches',
    fetchJson
  );

  const pitches = data?.pitches ?? [];

  const handleStatusChange = async (pitchId: string, newStatus: PitchStatusKey) => {
    setUpdating(pitchId);
    try {
      const res = await fetch(`/api/pr/pitches/${pitchId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Request failed');
      await mutate();
    } catch {
      // Error handled silently — pitch stays in current status
    } finally {
      setUpdating(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading pitches...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 py-8">
        <AlertCircle className="h-5 w-5" />
        Failed to load pitches. Please try again.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400">{pitches.length} total pitches</h3>
        {onNewPitch && (
          <button
            onClick={onNewPitch}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Send className="h-4 w-4" />
            New Pitch
          </button>
        )}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {STATUSES.map((col) => {
          const colPitches = pitches.filter((p) => p.status === col.key);
          return (
            <div
              key={col.key}
              className={cn('rounded-xl border p-3 min-h-[200px]', col.colour)}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                  {col.label}
                </span>
                <span className="text-xs text-gray-500 bg-white/5 rounded-full px-2 py-0.5">
                  {colPitches.length}
                </span>
              </div>
              <div className="space-y-2">
                {colPitches.map((pitch) => (
                  <PitchCard
                    key={pitch.id}
                    pitch={pitch}
                    onStatusChange={handleStatusChange}
                    updating={updating}
                  />
                ))}
                {colPitches.length === 0 && (
                  <div className="text-xs text-gray-600 text-center py-4">Empty</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
