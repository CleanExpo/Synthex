'use client';

/**
 * ReleaseTab — components/publish/ReleaseTab.tsx
 *
 * The studio human-release surface for nexus-viral video cuts (SYN-1075 WS4c).
 *
 * Lists every `queued_human_gated` cut for the active organisation, grouped by
 * hero, with a per-cut <video> preview, caption, and (for YouTube cuts) the
 * read-only search package. Each cut carries three actions:
 *   - Release → POST /api/publish-queue/release (queued_human_gated → pending)
 *   - Reject  → POST /api/publish-queue/release { action: 'reject' } (→ held)
 *   - Hold    → pure client no-op (the row stays gated for a later decision)
 *
 * The data key is org-scoped automatically: `useApi` scopes its cache by the
 * active organisation (SYN-908), so a brand switch refetches a different set and
 * one brand never sees another brand's cuts.
 *
 * SAFETY: this surface NEVER publishes directly. The only mutation it makes is
 * the human-gated release route, which is the sole path that can move a cut into
 * `pending`. Nothing here bypasses the gate.
 */

import { useCallback, useMemo, useState } from 'react';
import { useApi, useMutation, fetchWithAuth } from '@/hooks/use-api';
import type {
  GatedCut,
  GatedHeroGroup,
} from '@/app/api/publish-queue/gated/route';

interface GatedResponse {
  success: boolean;
  heroes: GatedHeroGroup[];
  totalCuts: number;
}

interface ReleaseResponse {
  success: boolean;
  action: 'release' | 'reject';
  affected: number;
}

type CutAction = 'release' | 'reject';

const PLATFORM_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  twitter: 'X / Twitter',
  threads: 'Threads',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  unassigned: 'Unassigned',
};

export function ReleaseTab(): React.ReactElement {
  const { data, isLoading, error, refetch } = useApi<GatedResponse>(
    '/api/publish-queue/gated'
  );

  // Cuts the user has locally "held" this session — hidden without a server
  // write (Hold is a deliberate no-op that leaves the row gated).
  const [heldItemIds, setHeldItemIds] = useState<Set<string>>(new Set());
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const releaseMutation = useMutation<
    ReleaseResponse,
    { itemIds: string[]; action: CutAction }
  >(
    variables =>
      fetchWithAuth<ReleaseResponse>('/api/publish-queue/release', {
        method: 'POST',
        body: JSON.stringify(variables),
      }),
    {
      onSuccess: () => {
        void refetch();
      },
    }
  );

  const runAction = useCallback(
    async (itemId: string, action: CutAction) => {
      setBusyItemId(itemId);
      setActionError(null);
      try {
        await releaseMutation.mutateAsync({ itemIds: [itemId], action });
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : 'Action failed. Please retry.'
        );
      } finally {
        setBusyItemId(null);
      }
    },
    [releaseMutation]
  );

  const hold = useCallback((itemId: string) => {
    setHeldItemIds(prev => new Set(prev).add(itemId));
  }, []);

  const heroes = useMemo<GatedHeroGroup[]>(() => {
    const groups = data?.heroes ?? [];
    return groups
      .map(group => ({
        ...group,
        cuts: group.cuts.filter(cut => !heldItemIds.has(cut.itemId)),
      }))
      .filter(group => group.cuts.length > 0);
  }, [data, heldItemIds]);

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-slate-400">Loading gated cuts…</div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-red-400">
        Could not load gated cuts: {error.message}
      </div>
    );
  }

  if (heroes.length === 0) {
    return (
      <div className="p-10 text-center text-slate-400">
        <p className="text-base font-medium text-slate-200">
          No cuts awaiting release
        </p>
        <p className="mt-1 text-sm">
          Derived cuts appear here for your approval before anything is
          published.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      {actionError && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {actionError}
        </div>
      )}

      {heroes.map(group => (
        <section key={group.heroId} className="space-y-4">
          <header className="flex items-baseline justify-between border-b border-slate-700 pb-2">
            <h3 className="text-lg font-semibold text-slate-100">
              {group.heroTitle ?? 'Untitled hero'}
            </h3>
            <span className="text-xs uppercase tracking-wide text-slate-500">
              {group.cuts.length} cut{group.cuts.length === 1 ? '' : 's'}{' '}
              awaiting release
            </span>
          </header>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {group.cuts.map(cut => (
              <ReleaseCutCard
                key={cut.itemId}
                cut={cut}
                busy={busyItemId === cut.itemId}
                onRelease={() => runAction(cut.itemId, 'release')}
                onReject={() => runAction(cut.itemId, 'reject')}
                onHold={() => hold(cut.itemId)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── Per-cut card ──────────────────────────────────────────────────────────────

interface ReleaseCutCardProps {
  cut: GatedCut;
  busy: boolean;
  onRelease: () => void;
  onReject: () => void;
  onHold: () => void;
}

function ReleaseCutCard({
  cut,
  busy,
  onRelease,
  onReject,
  onHold,
}: ReleaseCutCardProps): React.ReactElement {
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900/60">
      <div className="relative aspect-[9/16] max-h-80 bg-black">
        {cut.videoUrl ? (
          <video
            className="h-full w-full object-contain"
            src={cut.videoUrl}
            poster={cut.thumbnail ?? undefined}
            controls
            preload="metadata"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            No preview available
          </div>
        )}
        <span className="absolute left-2 top-2 rounded bg-slate-950/80 px-2 py-0.5 text-xs font-medium text-orange-400">
          {PLATFORM_LABEL[cut.platform] ?? cut.platform}
          {cut.aspectRatio ? ` · ${cut.aspectRatio}` : ''}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        {cut.caption && (
          <p className="line-clamp-3 text-sm text-slate-300">{cut.caption}</p>
        )}

        {cut.youtube && (
          <div className="rounded border border-slate-700 bg-slate-950/50 p-2 text-xs">
            <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
              YouTube search package (read-only)
            </p>
            <p className="font-medium text-slate-200">{cut.youtube.title}</p>
            {cut.youtube.description && (
              <p className="mt-1 line-clamp-2 text-slate-400">
                {cut.youtube.description}
              </p>
            )}
            {cut.youtube.tags && cut.youtube.tags.length > 0 && (
              <p className="mt-1 text-slate-500">
                {cut.youtube.tags.map(t => `#${t}`).join(' ')}
              </p>
            )}
          </div>
        )}

        <div className="mt-auto flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onRelease}
            className="flex-1 rounded bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Release'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onHold}
            className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Hold
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="rounded border border-red-500/50 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </article>
  );
}

export default ReleaseTab;
