'use client';

import { use, useState } from 'react';
import useSWR from 'swr';

interface StudioDraft {
  id: string;
  topic: string;
  script: string;
  status: string;
  videoUrl?: string | null;
  /** Why the video cannot be shown (the link could not be signed). */
  videoError?: string;
  platforms?: string[];
}

interface StudioBoard {
  clientSlug: string;
  displayName?: string;
  board: Record<string, StudioDraft[]>;
  total: number;
}

const fetcher = (url: string): Promise<StudioBoard> =>
  fetch(url, { credentials: 'include' }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

const COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'awaiting_approval', label: 'Awaiting approval' },
  { key: 'approved', label: 'Approved' },
  { key: 'published', label: 'Published' },
];

/**
 * The API signs a new 6-hour link on every read, and SWR re-reads on focus
 * and after Approve. Keep the first link so a video being watched is not
 * reloaded mid-play. If it stops working (expired), use a newer link if one
 * has arrived; otherwise ask the board for one, once per link, and switch
 * to it when it arrives.
 */
function ReviewVideo({
  url,
  label,
  onStale,
}: {
  url: string;
  label: string;
  onStale: () => void;
}) {
  const [src, setSrc] = useState(url);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  // A refresh was asked for and a different link has now arrived: take it.
  // (Setting state while rendering is React's pattern for adjusting state to
  // a new prop.)
  if (waitingFor !== null && url !== waitingFor) {
    setSrc(url);
    setWaitingFor(null);
  }
  return (
    <video
      controls
      playsInline
      preload="metadata"
      src={src}
      onError={() => {
        if (url !== src) {
          setSrc(url);
        } else if (waitingFor !== src) {
          setWaitingFor(src);
          onStale();
        }
      }}
      aria-label={label}
      className="mt-2 aspect-[9/16] w-full rounded-md bg-black"
    />
  );
}

export default function ClientStudioPage({
  params,
}: {
  params: Promise<{ client: string }>;
}) {
  const { client } = use(params);
  const endpoint = `/api/marketing-agency/studio/${client}`;
  const { data, error, isLoading, mutate } = useSWR<StudioBoard>(
    endpoint,
    fetcher
  );

  const [approveError, setApproveError] = useState<string | null>(null);

  async function approve(draftId: string): Promise<void> {
    setApproveError(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId }),
      });
      // A refused approval must never look like a silent success.
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setApproveError(body?.error ?? `Approval failed (HTTP ${res.status}).`);
      }
    } catch {
      // The request may or may not have reached the server, so say neither.
      setApproveError(
        'We could not confirm that approval. Check the status on this page before approving again.'
      );
    }
    // Re-read the board either way: it shows what was actually recorded.
    await mutate();
  }

  return (
    <div className="p-6 text-slate-100">
      <h1 className="text-2xl font-semibold">
        {data?.displayName ?? client} — Content Studio
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        Avatar + voice updates awaiting your sign-off. Nothing publishes to a
        client surface without approval.
      </p>

      {isLoading && <p className="mt-6 text-slate-400">Loading…</p>}
      {error && (
        <p className="mt-6 text-red-400">Failed to load the studio board.</p>
      )}
      {approveError && (
        <p role="alert" className="mt-6 text-red-400">
          {approveError}
        </p>
      )}

      {data && (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {COLUMNS.map(col => {
            const items = data.board?.[col.key] ?? [];
            return (
              <section
                key={col.key}
                className="rounded-xl border border-slate-700 bg-slate-900/50 p-4"
              >
                <h2 className="text-sm font-medium text-slate-300">
                  {col.label}{' '}
                  <span className="text-slate-500">({items.length})</span>
                </h2>
                <ul className="mt-3 space-y-3">
                  {items.length === 0 && (
                    <li className="text-xs text-slate-500">Nothing here.</li>
                  )}
                  {items.map(draft => (
                    <li
                      key={draft.id}
                      className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                    >
                      <p className="text-sm font-medium text-slate-100">
                        {draft.topic}
                      </p>
                      {draft.videoError && (
                        <p role="alert" className="mt-2 text-xs text-red-400">
                          {draft.videoError}
                        </p>
                      )}
                      {draft.videoUrl && (
                        <ReviewVideo
                          url={draft.videoUrl}
                          label={`Video: ${draft.topic}`}
                          onStale={() => void mutate()}
                        />
                      )}
                      <p className="mt-1 whitespace-pre-line text-xs text-slate-400">
                        {draft.script}
                      </p>
                      {col.key === 'awaiting_approval' && (
                        <button
                          type="button"
                          onClick={() => approve(draft.id)}
                          className="mt-3 rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-400"
                        >
                          Approve
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
