'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth, getUseApiActiveOrg, useApi } from '@/hooks/use-api';
import {
  NexusExportSchema,
  ProposalRecordSchema,
  type CaptureProposal,
  type ProposalRecord,
  type ReviewAction,
} from '@/lib/opportunity-review/schema';
import { ProposalCaptureForm, buttonClass } from './ProposalCaptureForm';
import { ProposalDetail, reviewLabels } from './ProposalDetail';

interface ProposalList {
  items: ProposalRecord[];
  total: number;
  scopeOrg: string | null;
}

export function OpportunityReviewWorkspace() {
  const org = getUseApiActiveOrg();
  const transform = useCallback(
    (response: unknown): ProposalList => {
      const list = response as { items: unknown; total: number };
      return {
        items: ProposalRecordSchema.array().parse(list.items),
        total: list.total,
        scopeOrg: org,
      };
    },
    [org]
  );
  const { data, isLoading, isValidating, error, refetch, mutate } =
    useApi<ProposalList>('/api/opportunity-proposals', {
      retryCount: 0,
      revalidateOnFocus: false,
      transform,
    });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    setSelectedId(null);
    setCapturing(false);
    setActionError('');
    setNotice('');
  }, [org]);
  const scopedData = data?.scopeOrg === org ? data : undefined;
  useEffect(() => {
    if (data && data.scopeOrg !== org) void refetch();
  }, [data, org, refetch]);
  const items = scopedData?.items ?? [];
  const selected = items.find(item => item.id === selectedId) ?? items[0];

  function replace(item: ProposalRecord) {
    mutate(previous => {
      const current = previous?.scopeOrg === org ? previous : undefined;
      return {
        scopeOrg: org,
        items: [
          item,
          ...(current?.items ?? []).filter(existing => existing.id !== item.id),
        ],
        total:
          (current?.total ?? 0) +
          (current?.items.some(existing => existing.id === item.id) ? 0 : 1),
      };
    });
    setSelectedId(item.id);
  }

  async function save(capture: CaptureProposal): Promise<boolean> {
    const startingOrg = getUseApiActiveOrg();
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      const result = await fetchWithAuth<{ item: ProposalRecord }>(
        '/api/opportunity-proposals',
        { method: 'POST', body: capture }
      );
      if (startingOrg !== getUseApiActiveOrg()) return false;
      replace(result.item);
      setCapturing(false);
      setNotice('Proposal saved for review.');
      return true;
    } catch (failure) {
      if (startingOrg === getUseApiActiveOrg())
        setActionError(
          failure instanceof Error
            ? failure.message
            : 'Proposal could not be saved.'
        );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function review(action: ReviewAction) {
    const startingOrg = getUseApiActiveOrg();
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      const result = await fetchWithAuth<{ item: ProposalRecord }>(
        '/api/opportunity-proposals',
        { method: 'PATCH', body: action }
      );
      if (startingOrg !== getUseApiActiveOrg()) return;
      replace(result.item);
      setNotice('Review saved. Execution remains blocked.');
    } catch (failure) {
      if (startingOrg === getUseApiActiveOrg())
        setActionError(
          failure instanceof Error
            ? failure.message
            : 'Review could not be saved.'
        );
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!selected || selected.review.state !== 'accepted') return;
    const startingOrg = getUseApiActiveOrg();
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      const bundle = NexusExportSchema.parse(
        await fetchWithAuth<unknown>(
          `/api/opportunity-proposals/${encodeURIComponent(selected.id)}/export`
        )
      );
      if (startingOrg !== getUseApiActiveOrg()) return;
      if (
        bundle.packetId !== selected.id ||
        bundle.revision !== selected.revision
      )
        throw new Error(
          'Proposal changed. Refresh before downloading its export.'
        );
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(bundle, null, 2)], {
          type: 'application/json',
        })
      );
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = `nexus-opportunity-${selected.id}-v1.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
      setNotice('Nexus v1 export downloaded. Execution remains blocked.');
    } catch (failure) {
      if (startingOrg === getUseApiActiveOrg())
        setActionError(
          failure instanceof Error
            ? failure.message
            : 'Export could not be downloaded.'
        );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 text-slate-100 sm:p-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold">Opportunity review</h1>
        <p className="max-w-3xl text-sm text-slate-300">
          Capture real sources, record separate Unite-Group evidence, and review
          a decision-ready proposal for the active organisation. Every proposal
          stays blocked for forecasting review.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            className={buttonClass}
            disabled={busy || capturing || isLoading || !scopedData || !!error}
            onClick={() => {
              setCapturing(true);
              setActionError('');
              setNotice('');
            }}
          >
            Capture proposal
          </button>
          <button
            className={buttonClass}
            disabled={busy || isLoading || isValidating}
            onClick={() => void refetch()}
          >
            {isValidating ? 'Refreshing…' : 'Refresh proposals'}
          </button>
        </div>
      </header>
      {isLoading && <p role="status">Loading proposals…</p>}
      {error && (
        <div
          role="alert"
          className="space-y-3 rounded-sm border border-red-400/30 p-4"
        >
          <p>Could not load proposals: {error.message}</p>
          <button className={buttonClass} onClick={() => void refetch()}>
            Retry loading proposals
          </button>
        </div>
      )}
      {actionError && (
        <p
          role="alert"
          className="rounded-sm border border-red-400/30 p-4 text-sm text-red-200"
        >
          {actionError} Refresh proposals before retrying a review that changed.
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-200">
          {notice}
        </p>
      )}
      {busy && (
        <p role="status" className="text-sm text-slate-300">
          Saving or downloading…
        </p>
      )}
      {!isLoading && !error && scopedData && items.length === 0 && (
        <p className="rounded-sm border border-white/10 p-4 text-sm text-slate-300">
          No proposals for the active organisation. Capture a real source and
          your next validation step to begin.
        </p>
      )}
      {capturing && !error && (
        <ProposalCaptureForm
          key={org ?? 'current-org'}
          busy={busy}
          onSave={save}
          onCancel={() => {
            setCapturing(false);
            setActionError('');
          }}
        />
      )}
      {!isLoading && !error && scopedData && items.length > 0 && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(220px,1fr)_minmax(0,3fr)]">
          <nav aria-label="Opportunity proposals" className="space-y-3">
            <p className="text-sm text-slate-300">
              {scopedData?.total} proposals
            </p>
            {items.map(item => (
              <button
                key={item.id}
                className={`${buttonClass} w-full text-left`}
                aria-pressed={selected?.id === item.id}
                disabled={busy}
                onClick={() => {
                  setSelectedId(item.id);
                  setActionError('');
                  setNotice('');
                }}
              >
                {item.proposal.title} — {reviewLabels[item.review.state]}
              </button>
            ))}
          </nav>
          {selected && (
            <ProposalDetail
              key={`${selected.id}-${selected.revision}`}
              item={selected}
              busy={busy}
              onReview={review}
              onExport={download}
            />
          )}
        </div>
      )}
    </div>
  );
}
