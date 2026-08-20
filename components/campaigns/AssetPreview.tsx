'use client';

/**
 * Campaign asset preview — publish or regenerate copy (scheduling is separate / coming soon).
 */

import { useEffect, useState } from 'react';
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
  topic?: string;
}

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

const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'var(--platform-twitter)',
  linkedin: 'var(--platform-linkedin)',
  instagram: 'var(--platform-instagram)',
  facebook: 'var(--platform-facebook)',
  tiktok: 'var(--accent-brand)',
  multi: 'var(--accent-brand)',
};

export function AssetPreview({ assets }: AssetPreviewProps) {
  const [items, setItems] = useState<CampaignAsset[]>(assets);
  const [status, setStatus] = useState<Record<string, AssetStatus>>({});

  useEffect(() => {
    setItems(assets);
  }, [assets]);

  function setAssetStatus(id: string, next: AssetStatus) {
    setStatus(prev => ({ ...prev, [id]: next }));
  }

  async function publish(asset: CampaignAsset) {
    setAssetStatus(asset.id, { kind: 'publishing' });
    try {
      const res = await fetch('/api/social/post', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: asset.content,
          platforms: [asset.platform === 'multi' ? 'twitter' : asset.platform],
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
        credentials: 'include',
        body: JSON.stringify({
          platform: regenPlatform(asset.platform),
          topic: asset.topic || asset.content.slice(0, 200) || asset.platform,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        content?: unknown;
        code?: string;
      };
      if (!res.ok) {
        if (body.code === 'API_KEY_REQUIRED') {
          throw new Error(
            'Connect an AI API key in Settings → AI Credentials.'
          );
        }
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
    return <p className="text-xs text-white/30">No assets to preview yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map(asset => {
        const st = status[asset.id] ?? { kind: 'idle' };
        const busy = st.kind === 'publishing' || st.kind === 'regenerating';
        const accent = PLATFORM_COLORS[asset.platform] ?? 'var(--accent-brand)';

        return (
          <article
            key={asset.id}
            className="flex flex-col border-[0.5px] border-white/6 bg-white/1 rounded-sm overflow-hidden"
          >
            <div className="flex aspect-video items-center justify-center bg-black/25 border-b border-white/4">
              {asset.imageUrl ? (
                <img
                  src={asset.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="h-7 w-7 text-white/15" />
              )}
            </div>

            <div className="flex flex-1 flex-col gap-3 p-4">
              <span
                className="inline-flex w-fit rounded-sm border-[0.5px] px-2 py-0.5 text-xs font-medium uppercase tracking-wide"
                style={{
                  color: accent,
                  borderColor: `${accent}33`,
                  backgroundColor: `${accent}12`,
                }}
              >
                {asset.platform}
              </span>
              <p className="flex-1 text-xs leading-relaxed text-white/65 whitespace-pre-wrap">
                {asset.content}
              </p>

              {st.kind === 'published' && (
                <p
                  role="status"
                  className="flex items-center gap-1.5 text-xs text-emerald-400"
                >
                  <CheckCircle2 className="h-3 w-3" /> Published
                </p>
              )}
              {st.kind === 'error' && (
                <p
                  role="alert"
                  className="flex items-start gap-1.5 text-xs text-red-300"
                >
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{st.message}</span>
                </p>
              )}

              <div className="mt-auto flex gap-2 pt-1">
                <button
                  type="button"
                  aria-label={`Publish ${asset.platform} asset`}
                  disabled={busy || st.kind === 'published'}
                  onClick={() => void publish(asset)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-orange-500 px-3 py-2 text-[11px] font-medium text-surface-dark hover:bg-orange-400 disabled:opacity-50"
                >
                  {st.kind === 'publishing' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  Publish
                </button>
                <button
                  type="button"
                  aria-label={`Regenerate ${asset.platform} asset`}
                  disabled={busy}
                  onClick={() => void regenerate(asset)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-sm border-[0.5px] border-white/8 bg-white/2 px-3 py-2 text-[11px] text-white/55 hover:bg-white/4 disabled:opacity-50"
                >
                  {st.kind === 'regenerating' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
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
