'use client';

/**
 * Campaigns dashboard (SYN-381, Task 34).
 *
 * Lists the org-scoped campaigns from `GET /api/campaigns` and drives the
 * Phase-8 create flow: Brand Scanner → Campaign Generator → Asset Preview.
 * All three sub-surfaces call the existing governed endpoints; publishing stays
 * honest about OAuth-gated platforms.
 */
import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Plus, Loader2, AlertCircle } from '@/components/icons';
import {
  BrandScanner,
  type BrandDnaPreview,
} from '@/components/campaigns/BrandScanner';
import {
  CampaignGenerator,
  type CreatedCampaign,
} from '@/components/campaigns/CampaignGenerator';
import {
  AssetPreview,
  type CampaignAsset,
} from '@/components/campaigns/AssetPreview';

interface CampaignPostSummary {
  id: string;
  status: string;
  platform: string;
}

interface Campaign {
  id: string;
  name: string;
  platform: string;
  content?: string | null;
  status: string;
  createdAt?: string;
  posts?: CampaignPostSummary[];
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-white/[0.06] text-white/60',
  scheduled: 'bg-blue-500/15 text-blue-300',
  active: 'bg-emerald-500/15 text-emerald-300',
  paused: 'bg-amber-500/15 text-amber-300',
  completed: 'bg-purple-500/15 text-purple-300',
  archived: 'bg-white/[0.04] text-white/40',
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${style}`}
    >
      {status}
    </span>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [seedName, setSeedName] = useState('');
  const [seedContent, setSeedContent] = useState('');
  const [previewAssets, setPreviewAssets] = useState<CampaignAsset[]>([]);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/campaigns');
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          body.error ?? `Failed to load campaigns (${res.status})`
        );
      }
      const data = (await res.json()) as { campaigns?: Campaign[] };
      setCampaigns(data.campaigns ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load campaigns.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  function handleScanned(preview: BrandDnaPreview) {
    setSeedName(preview.businessName);
    setSeedContent(preview.firstPost);
    setCreating(true);
  }

  function handleCreated(campaign: CreatedCampaign) {
    setCampaigns(prev => [
      {
        id: campaign.id,
        name: campaign.name,
        platform: campaign.platform,
        content: campaign.content,
        status: campaign.status,
      },
      ...prev,
    ]);
    if (campaign.content) {
      setPreviewAssets([
        {
          id: campaign.id,
          platform: campaign.platform,
          content: campaign.content,
          campaignId: campaign.id,
          topic: campaign.name,
        },
      ]);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-orange-400" />
            <h1 className="text-2xl font-light text-white tracking-wide">
              Campaigns
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setCreating(c => !c)}
            className="inline-flex items-center gap-1.5 rounded-sm bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
          >
            <Plus className="h-4 w-4" />
            {creating ? 'Close' : 'New campaign'}
          </button>
        </div>
        <p className="text-sm text-white/50">
          Scan your brand, generate a campaign, and publish assets.
        </p>
        <div className="h-px bg-white/[0.06] mt-4" />
      </div>

      {/* Create flow */}
      {creating && (
        <div className="space-y-6">
          <BrandScanner onScanned={handleScanned} />
          <CampaignGenerator
            initialName={seedName}
            initialContent={seedContent}
            onCreated={handleCreated}
          />
          {previewAssets.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Assets
              </h2>
              <AssetPreview assets={previewAssets} />
            </section>
          )}
        </div>
      )}

      {/* Campaign list */}
      {loading ? (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-white/50"
        >
          <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
          Loading campaigns…
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-2">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadCampaigns()}
              className="rounded-sm border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/[0.04]"
            >
              Retry
            </button>
          </div>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] p-10 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-white/20" />
          <h3 className="mt-3 text-sm font-semibold text-white">
            No campaigns yet
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-white/50">
            Create your first campaign to start generating and publishing
            content across your platforms.
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-sm bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
          >
            <Plus className="h-4 w-4" /> New campaign
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map(campaign => (
            <li
              key={campaign.id}
              className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.01] backdrop-blur-sm p-5 hover:border-white/[0.12] transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">
                  {campaign.name}
                </h3>
                <StatusBadge status={campaign.status} />
              </div>
              <span className="w-fit rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-white/60">
                {campaign.platform}
              </span>
              {campaign.content && (
                <p className="line-clamp-3 text-xs leading-relaxed text-white/60">
                  {campaign.content}
                </p>
              )}
              {campaign.posts && campaign.posts.length > 0 && (
                <p className="mt-auto text-xs text-white/40">
                  {campaign.posts.length} post
                  {campaign.posts.length === 1 ? '' : 's'}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
