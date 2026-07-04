'use client';

/**
 * Admin: Marketing Orchestrator Review Gate — SYN-967 (10x Organic Marketing Engine)
 *
 * Owner-only surface (gated by /dashboard/admin/layout.tsx). Submits a single
 * brief to POST /api/marketing/orchestrate, which returns a generated authority
 * set in a `pending_review` state — NOT published. Each generated asset can be
 * approved or rejected here; approval only marks the asset reviewed (no publish
 * in this slice). Review state is held in-session — persistence is a follow-up
 * (SYN-967) pending the founder decision on the approval table/column.
 */

import { useState } from 'react';

type ReviewState = 'pending_review' | 'approved' | 'rejected';

interface Draft {
  slotId: string;
  channel: string;
  title: string;
  body: string;
  cta: string;
  publishInstruction: string;
}

interface OrchestrateResponse {
  data: {
    reviewState: 'pending_review';
    campaignId: string;
    generatedAt: string;
    assetCount: number;
    set: { drafts: Draft[] };
  };
}

const EMPTY_BRIEF = {
  slug: '',
  name: '',
  positioning: '',
  audience: '',
  objective: '',
};

export default function MarketingOrchestratorPage() {
  const [brief, setBrief] = useState(EMPTY_BRIEF);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [reviews, setReviews] = useState<Record<string, ReviewState>>({});
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function orchestrate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/marketing/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business: {
            slug: brief.slug.trim(),
            name: brief.name.trim(),
            positioning: brief.positioning.trim(),
            audience: brief.audience
              .split(',')
              .map(a => a.trim())
              .filter(Boolean),
          },
          objective: brief.objective.trim(),
          horizonDays: 7,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          body.message ?? body.error ?? `Request failed (${res.status})`
        );
        return;
      }
      const body: OrchestrateResponse = await res.json();
      setDrafts(body.data.set.drafts);
      setCampaignId(body.data.campaignId);
      setReviews(
        Object.fromEntries(
          body.data.set.drafts.map(d => [
            d.slotId,
            'pending_review' as ReviewState,
          ])
        )
      );
    } catch {
      setError('Network error — could not reach the orchestrator.');
    } finally {
      setLoading(false);
    }
  }

  function setReview(slotId: string, state: ReviewState) {
    setReviews(prev => ({ ...prev, [slotId]: state }));
  }

  const pendingCount = Object.values(reviews).filter(
    r => r === 'pending_review'
  ).length;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-lg font-medium text-white/80 uppercase tracking-widest">
          Marketing Orchestrator — Review Gate
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Generate an organic authority set from a brief, then approve or reject
          each asset. Nothing is published — approval marks the asset reviewed.
        </p>
      </header>

      <form
        onSubmit={orchestrate}
        className="border-[0.5px] border-white/[0.06] rounded-sm p-5 space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <input
            className="bg-transparent border-[0.5px] border-white/[0.1] rounded-sm px-3 py-2 text-sm text-white/80"
            placeholder="Business name"
            value={brief.name}
            onChange={e => setBrief({ ...brief, name: e.target.value })}
            required
          />
          <input
            className="bg-transparent border-[0.5px] border-white/[0.1] rounded-sm px-3 py-2 text-sm text-white/80"
            placeholder="Slug (e.g. ccw)"
            value={brief.slug}
            onChange={e => setBrief({ ...brief, slug: e.target.value })}
            required
          />
        </div>
        <input
          className="w-full bg-transparent border-[0.5px] border-white/[0.1] rounded-sm px-3 py-2 text-sm text-white/80"
          placeholder="Positioning"
          value={brief.positioning}
          onChange={e => setBrief({ ...brief, positioning: e.target.value })}
          required
        />
        <input
          className="w-full bg-transparent border-[0.5px] border-white/[0.1] rounded-sm px-3 py-2 text-sm text-white/80"
          placeholder="Audience (comma-separated)"
          value={brief.audience}
          onChange={e => setBrief({ ...brief, audience: e.target.value })}
          required
        />
        <input
          className="w-full bg-transparent border-[0.5px] border-white/[0.1] rounded-sm px-3 py-2 text-sm text-white/80"
          placeholder="Objective"
          value={brief.objective}
          onChange={e => setBrief({ ...brief, objective: e.target.value })}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="text-sm px-4 py-2 border-[0.5px] border-white/[0.15] rounded-sm text-white/80 hover:bg-white/[0.05] disabled:opacity-50"
        >
          {loading ? 'Orchestrating…' : 'Generate set for review'}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>

      {drafts.length > 0 && (
        <div className="border-[0.5px] border-white/[0.06] rounded-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white/60 uppercase tracking-widest">
              Pending Review{campaignId ? ` — ${campaignId}` : ''}
            </h3>
            <span className="text-xs text-white/50">
              {pendingCount} awaiting
            </span>
          </div>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {drafts.map(draft => {
              const state = reviews[draft.slotId] ?? 'pending_review';
              return (
                <div
                  key={draft.slotId}
                  className="border-[0.5px] border-white/[0.06] rounded-sm p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40 uppercase tracking-widest">
                      {draft.channel}
                    </span>
                    <span
                      className={
                        state === 'approved'
                          ? 'text-xs text-emerald-400'
                          : state === 'rejected'
                            ? 'text-xs text-red-400'
                            : 'text-xs text-white/40'
                      }
                    >
                      {state.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-white/80 mt-2">{draft.title}</p>
                  <p className="text-xs text-white/50 mt-1 line-clamp-2">
                    {draft.body}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => setReview(draft.slotId, 'approved')}
                      className="text-xs px-3 py-1 border-[0.5px] border-emerald-500/40 rounded-sm text-emerald-400 hover:bg-emerald-500/10"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setReview(draft.slotId, 'rejected')}
                      className="text-xs px-3 py-1 border-[0.5px] border-red-500/40 rounded-sm text-red-400 hover:bg-red-500/10"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
