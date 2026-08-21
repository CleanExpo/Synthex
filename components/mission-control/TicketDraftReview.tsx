'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2, Trash2 } from '@/components/icons';
import type { MissionDraftTicket } from '@/lib/mission-control/types';

export function TicketDraftReview({
  missionId,
  drafts: initial,
  projectName,
  onApproved,
  onDrafted,
}: {
  missionId: string;
  drafts: MissionDraftTicket[];
  projectName: string | null;
  onApproved: (mission: unknown) => void;
  onDrafted: (mission: unknown) => void;
}) {
  const [drafts, setDrafts] = useState(initial);
  const [busy, setBusy] = useState<'draft' | 'approve' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  const generate = async () => {
    setBusy('draft');
    setError(null);
    try {
      const res = await fetch('/api/mission-control/draft-tickets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      setDrafts(data.mission.draftTickets ?? []);
      setSource(data.source ?? null);
      onDrafted(data.mission);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Draft failed');
    } finally {
      setBusy(null);
    }
  };

  const approve = async () => {
    setBusy('approve');
    setError(null);
    try {
      const res = await fetch('/api/mission-control/approve-tickets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missionId,
          approve: true,
          drafts: drafts.map(d => ({
            localId: d.localId,
            title: d.title,
            description: d.description,
            acceptanceCriteria: d.acceptanceCriteria,
            technicalNotes: d.technicalNotes,
            suggestedFiles: d.suggestedFiles,
            estimateHours: d.estimateHours,
            labels: d.labels,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      onApproved(data.mission);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setBusy(null);
    }
  };

  const update = (localId: string, patch: Partial<MissionDraftTicket>) => {
    setDrafts(prev =>
      prev.map(d => (d.localId === localId ? { ...d, ...patch } : d))
    );
  };

  const remove = (localId: string) => {
    setDrafts(prev => prev.filter(d => d.localId !== localId));
  };

  if (drafts.length === 0) {
    return (
      <div className="border-[0.5px] border-white/6 bg-white/1 rounded-sm p-5 space-y-4">
        <div>
          <p className="text-[9px] uppercase tracking-[0.22em] text-white/30 mb-1">
            Ticket drafting
          </p>
          <h3 className="text-lg font-light text-white">
            Generate detailed Linear tickets
          </h3>
          <p className="text-sm text-white/40 mt-1">
            Project: {projectName || '—'}. Drafts stay local until you approve.
          </p>
        </div>
        {error && (
          <p className="text-xs text-red-300/90 border-[0.5px] border-red-500/20 bg-red-500/5 px-3 py-2 rounded-sm">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={generate}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-sm bg-[#FF6B35] text-[#050508] disabled:opacity-50"
        >
          {busy === 'draft' && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          Draft tickets
        </button>
      </div>
    );
  }

  return (
    <div className="border-[0.5px] border-white/6 bg-white/1 rounded-sm p-5 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9px] uppercase tracking-[0.22em] text-white/30 mb-1">
            Approval gate
          </p>
          <h3 className="text-lg font-light text-white">
            Review {drafts.length} draft
            {drafts.length === 1 ? '' : 's'}
          </h3>
          <p className="text-sm text-white/40 mt-1">
            Edit or remove before creating in Linear
            {source ? ` · source: ${source}` : ''}.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={busy !== null}
          className="text-xs text-white/40 hover:text-white/70"
        >
          Re-draft
        </button>
      </div>

      <div className="space-y-3">
        {drafts.map((d, i) => (
          <div
            key={d.localId}
            className="border-[0.5px] border-white/8 bg-black/20 rounded-sm p-4 space-y-3"
          >
            <div className="flex items-start gap-2">
              <span className="text-[10px] text-white/30 mt-2 w-5">
                {i + 1}
              </span>
              <input
                value={d.title}
                onChange={e => update(d.localId, { title: e.target.value })}
                className="flex-1 bg-transparent border-b border-white/10 focus:border-[#FF6B35]/40 outline-none text-sm text-white py-1"
              />
              <button
                type="button"
                onClick={() => remove(d.localId)}
                className="p-1.5 text-white/30 hover:text-red-300"
                aria-label="Remove ticket"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <textarea
              value={d.description}
              onChange={e =>
                update(d.localId, { description: e.target.value })
              }
              rows={3}
              className="w-full bg-black/20 border-[0.5px] border-white/8 rounded-sm px-2.5 py-2 text-xs text-white/80 focus:outline-none focus:border-[#FF6B35]/35"
            />
            <div>
              <p className="text-[9px] uppercase tracking-[0.16em] text-white/30 mb-1">
                Acceptance
              </p>
              <textarea
                value={d.acceptanceCriteria.join('\n')}
                onChange={e =>
                  update(d.localId, {
                    acceptanceCriteria: e.target.value
                      .split('\n')
                      .map(s => s.trim())
                      .filter(Boolean),
                  })
                }
                rows={3}
                className="w-full bg-black/20 border-[0.5px] border-white/8 rounded-sm px-2.5 py-2 text-xs text-white/70 focus:outline-none focus:border-[#FF6B35]/35"
              />
            </div>
            {(d.suggestedFiles.length > 0 || d.labels.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {d.labels.map(l => (
                  <span
                    key={l}
                    className="text-[9px] uppercase tracking-wider text-[#FF6B35]/80 border-[0.5px] border-[#FF6B35]/25 px-1.5 py-0.5 rounded-sm"
                  >
                    {l}
                  </span>
                ))}
                {d.suggestedFiles.slice(0, 6).map(f => (
                  <span
                    key={f}
                    className="text-[10px] text-white/35 border-[0.5px] border-white/8 px-1.5 py-0.5 rounded-sm font-mono"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="text-xs text-red-300/90 border-[0.5px] border-red-500/20 bg-red-500/5 px-3 py-2 rounded-sm">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={approve}
          disabled={busy !== null || drafts.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-sm bg-[#FF6B35] text-[#050508] disabled:opacity-50"
        >
          {busy === 'approve' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          Approve & create in Linear
        </button>
      </div>
    </div>
  );
}
