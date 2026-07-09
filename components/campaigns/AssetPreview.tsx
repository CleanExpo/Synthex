'use client';

/**
 * AssetPreview — Phase-8 campaign dashboard (SYN-381, Task 37).
 *
 * A grid of generated campaign assets, each with two actions:
 *
 *  - Publish   → POST /api/social/post ({ content, platforms, hashtags,
 *                mediaUrls, campaignId }). This is the real, governed publish
 *                path. When a platform's Meta/social OAuth connection isn't live,
 *                the endpoint returns an error/gated payload — the button
 *                surfaces that verbatim (SYN-1054). It never fakes success.
 *
 *  - Regenerate → POST /api/content/generate ({ platform, topic }). Replaces the
 *                asset's content in place with the returned copy.
 *
 * The Publish button is deliberately honest: a non-2xx response leaves the asset
 * in an error state showing the server's reason (e.g. "No connected account for
 * instagram"), so an OAuth-gated platform never appears "published".
 */
import { useState } from 'react';
import {
  Send,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
} from '@/components/icons';

export interface CampaignAsset {
  id: string;
  platform: string;
  content: string;
  imageUrl?: string | null;
  hashtags?: string[];
  campaignId?: string;
  /** Topic used to regenerate copy; falls back to a content excerpt. */
  topic?: string;
}

/** content/generate accepts these; 'multi' is not valid there. */
const REGENERATABLE_PLATFORMS = new Set([
  'twitter',
  'linkedin',
  'instagram',
  'facebook',
  'tiktok',
  'threads',
]);

function regenPlatform(platform: string): string {
  return REGENERATABLE_PLATFORMS.has(platform) ? platform : 'twitter';
}

type AssetStatus =
  | { kind: 'idle' }
  | { kind: 'publishing' }
  | { kind: 'regenerating' }
  | { kind: 'published' }
  | { kind: 'error'; message: string };

export interface AssetPreviewProps {
  assets: CampaignAsset[];
}

export function AssetPreview({ assets }: AssetPreviewProps) {
  const [items, setItems] = useState<CampaignAsset[]>(assets);
  const [status, setStatus] = useState<Record<string, AssetStatus>>({});

  function setAssetStatus(id: string, next: AssetStatus) {
    setStatus(prev => ({ ...prev, [id]: next }));
  }

  async function publish(asset: CampaignAsset) {
    setAssetStatus(asset.id, { kind: 'publishing' });
    try {
      const res = await fetch('/api/social/post', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          content: asset.content,
          platforms: [asset.platform],
          hashtags: asset.hashtags ?? [],
          mediaUrls: asset.imageUrl ? [asset.imageUrl] : [],
          ...(asset.campaignId ? { campaignId: asset.campaignId } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        // Honest surfacing: OAuth-gated / unconnected platforms land here.
        throw new Error(
          body.error ?? body.message ?? `Publish failed (${res.status})`
        );
      }
      setAssetStatus(asset.id, { kind: 'published' });
    } catch (err) {
      setAssetStatus(asset.id, {
        kind: 'error',
        message: err instanceof Error ? err.message : 'Publish failed.',
      });
    }
  }

  async function regenerate(asset: CampaignAsset) {
    setAssetStatus(asset.id, { kind: 'regenerating' });
    try {
      const res = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          platform: regenPlatform(asset.platform),
          topic: asset.topic || asset.content.slice(0, 200) || asset.platform,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        content?: unknown;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `Regenerate failed (${res.status})`);
      }
      const nextContent =
        typeof body.content === 'string'
          ? body.content
          : ((body.content as { text?: string; body?: string })?.text ??
            (body.content as { body?: string })?.body ??
            asset.content);
      setItems(prev =>
        prev.map(a => (a.id === asset.id ? { ...a, content: nextContent } : a))
      );
      setAssetStatus(asset.id, { kind: 'idle' });
    } catch (err) {
      setAssetStatus(asset.id, {
        kind: 'error',
        message: err instanceof Error ? err.message : 'Regenerate failed.',
      });
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-white/50">No assets to preview yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(asset => {
        const st = status[asset.id] ?? { kind: 'idle' };
        const busy = st.kind === 'publishing' || st.kind === 'regenerating';
        return (
          <article
            key={asset.id}
            className="flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.01] backdrop-blur-sm overflow-hidden"
          >
            <div className="flex aspect-video items-center justify-center bg-black/30">
              {asset.imageUrl ? (
                <img
                  src={asset.imageUrl}
                  alt={`${asset.platform} asset`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-white/20" />
              )}
            </div>

            <div className="flex flex-1 flex-col gap-3 p-4">
              <span className="inline-flex w-fit rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-white/60">
                {asset.platform}
              </span>
              <p className="flex-1 text-xs leading-relaxed text-white/80 whitespace-pre-wrap">
                {asset.content}
              </p>

              {st.kind === 'published' && (
                <p
                  role="status"
                  className="flex items-center gap-1.5 text-xs text-emerald-300"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Published
                </p>
              )}
              {st.kind === 'error' && (
                <p
                  role="alert"
                  className="flex items-start gap-1.5 text-xs text-red-300"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{st.message}</span>
                </p>
              )}

              <div className="mt-auto flex gap-2">
                <button
                  type="button"
                  aria-label={`Publish ${asset.platform} asset`}
                  disabled={busy || st.kind === 'published'}
                  onClick={() => publish(asset)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-400 disabled:opacity-50"
                >
                  {st.kind === 'publishing' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Publish
                </button>
                <button
                  type="button"
                  aria-label={`Regenerate ${asset.platform} asset`}
                  disabled={busy}
                  onClick={() => regenerate(asset)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-sm border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.04] disabled:opacity-50"
                >
                  {st.kind === 'regenerating' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Regenerate
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
