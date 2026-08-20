'use client';

/**
 * Campaigns dashboard — brand scan → AI campaign generation → asset preview.
 * Scheduling is intentionally disabled (coming soon); generation requires AI API key.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Megaphone,
  Plus,
  Loader2,
  AlertCircle,
  Sparkles,
  Layers,
  Key,
  Clock,
  ArrowRight,
  X,
} from '@/components/icons';
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
import { useUser } from '@/hooks/use-user';

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
  draft: 'text-white/45 border-white/8 bg-white/2',
  scheduled: 'text-blue-300/90 border-blue-400/20 bg-blue-500/10',
  active: 'text-emerald-300/90 border-emerald-400/20 bg-emerald-500/10',
  paused: 'text-amber-300/90 border-amber-400/20 bg-amber-500/10',
  completed: 'text-purple-300/90 border-purple-400/20 bg-purple-500/10',
  archived: 'text-white/30 border-white/6 bg-white/1',
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      className={`inline-flex rounded-sm border-[0.5px] px-2 py-0.5 text-xs font-medium uppercase tracking-[0.14em] ${style}`}
    >
      {status}
    </span>
  );
}

function platformLabel(p: string): string {
  const map: Record<string, string> = {
    twitter: 'Twitter / X',
    linkedin: 'LinkedIn',
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    threads: 'Threads',
    multi: 'Multi-platform',
  };
  return map[p] ?? p;
}

export default function CampaignsPage() {
  const { user } = useUser();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [seedName, setSeedName] = useState('');
  const [seedContent, setSeedContent] = useState('');
  const [previewAssets, setPreviewAssets] = useState<CampaignAsset[]>([]);
  const [aiKeyConfigured, setAiKeyConfigured] = useState<boolean | null>(null);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/campaigns', { credentials: 'include' });
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

  useEffect(() => {
    if (!user) return;
    const extended = user as typeof user & { apiKeyConfigured?: boolean };
    if (typeof extended.apiKeyConfigured === 'boolean') {
      setAiKeyConfigured(extended.apiKeyConfigured);
    }
  }, [user]);

  const stats = useMemo(() => {
    const drafts = campaigns.filter(c => c.status === 'draft').length;
    const active = campaigns.filter(c => c.status === 'active').length;
    const posts = campaigns.reduce((n, c) => n + (c.posts?.length ?? 0), 0);
    return { total: campaigns.length, drafts, active, posts };
  }, [campaigns]);

  function handleScanned(preview: BrandDnaPreview) {
    setSeedName(preview.businessName);
    setSeedContent(preview.firstPost);
    setStudioOpen(true);
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
    setAiKeyConfigured(true);
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-white/30 mb-1">
            Marketing
          </p>
          <h1 className="text-3xl font-light text-white leading-none">
            Campaigns
          </h1>
          <p className="text-sm text-white/40 mt-1.5 max-w-lg">
            Scan your brand, pick a business, generate AI campaign copy, and
            save drafts. Scheduling launches soon.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStudioOpen(o => !o)}
          className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-sm bg-orange-500 hover:bg-orange-400 text-surface-dark transition-colors shrink-0"
        >
          {studioOpen ? (
            <>
              <X className="h-4 w-4" /> Close studio
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> New campaign
            </>
          )}
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Campaigns', value: stats.total, icon: Megaphone },
          { label: 'Drafts', value: stats.drafts, icon: Layers },
          { label: 'Active', value: stats.active, icon: Sparkles },
          { label: 'Linked posts', value: stats.posts, icon: ArrowRight },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex flex-col gap-2 px-4 py-3 border-[0.5px] border-white/6 bg-white/1.5 rounded-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.22em] text-white/35">
                {label}
              </span>
              <Icon className="h-3.5 w-3.5 text-orange-400/80" />
            </div>
            <span className="font-mono text-xl tabular-nums text-white">
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* AI key + scheduling notices */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 border-[0.5px] border-white/6 bg-white/1 rounded-sm px-4 py-3">
          <Key className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-white/75">AI generation</p>
            <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">
              Campaign copy is generated via your connected AI provider.{' '}
              {aiKeyConfigured === false && (
                <Link
                  href="/dashboard/settings?tab=ai-credentials"
                  className="text-orange-400 hover:text-orange-300"
                >
                  Connect API key →
                </Link>
              )}
              {aiKeyConfigured !== false && (
                <span className="text-white/50">
                  Use Settings → AI Credentials if generation is blocked.
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 border-[0.5px] border-white/6 bg-white/1 rounded-sm px-4 py-3 opacity-90">
          <Clock className="h-4 w-4 text-white/30 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-white/55">Scheduling</p>
            <p className="text-[11px] text-white/35 mt-0.5">
              Coming soon — campaigns save as drafts; publish from Assets when
              ready.
            </p>
          </div>
        </div>
      </div>

      {/* Campaign studio */}
      {studioOpen && (
        <div className="space-y-5 border-[0.5px] border-orange-500/15 bg-orange-500/2 rounded-sm p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-medium text-white/85">
              Campaign studio
            </h2>
          </div>
          <BrandScanner onScanned={handleScanned} />
          <CampaignGenerator
            key={`${seedName}-${seedContent}`}
            initialName={seedName}
            initialContent={seedContent}
            onCreated={handleCreated}
          />
          {previewAssets.length > 0 && (
            <section className="space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-white/30">
                Generated assets
              </p>
              <AssetPreview assets={previewAssets} />
            </section>
          )}
        </div>
      )}

      {/* Campaign library */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.22em] text-white/30">
            Your campaigns
          </p>
          {!loading && !error && (
            <span className="text-xs text-white/35 tabular-nums">
              {campaigns.length} total
            </span>
          )}
        </div>

        {loading ? (
          <div
            role="status"
            className="flex items-center gap-2 text-sm text-white/45 py-8"
          >
            <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
            Loading campaigns…
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-sm border-[0.5px] border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-2">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void loadCampaigns()}
                className="rounded-sm border-[0.5px] border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/3"
              >
                Retry
              </button>
            </div>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="border-[0.5px] border-dashed border-white/8 bg-white/1 rounded-sm p-12 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-white/15" />
            <h3 className="mt-4 text-sm font-medium text-white/75">
              No campaigns yet
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-white/40">
              Open the studio to scan your site, choose a brand, and generate
              your first campaign draft.
            </p>
            <button
              type="button"
              onClick={() => setStudioOpen(true)}
              className="mt-5 inline-flex items-center gap-1.5 rounded-sm bg-orange-500 px-4 py-2 text-sm font-medium text-surface-dark hover:bg-orange-400"
            >
              <Plus className="h-4 w-4" /> Start studio
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {campaigns.map(campaign => (
              <li
                key={campaign.id}
                className="group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-4 border-[0.5px] border-white/6 bg-white/1.5 rounded-sm hover:bg-white/2.5 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-white/85 truncate">
                      {campaign.name}
                    </h3>
                    <StatusBadge status={campaign.status} />
                  </div>
                  <p className="text-xs text-white/35 uppercase tracking-wide">
                    {platformLabel(campaign.platform)}
                    {campaign.posts && campaign.posts.length > 0 && (
                      <span className="normal-case text-white/30 ml-2">
                        · {campaign.posts.length} post
                        {campaign.posts.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </p>
                  {campaign.content && (
                    <p className="mt-2 text-xs text-white/45 line-clamp-2 leading-relaxed">
                      {campaign.content}
                    </p>
                  )}
                </div>
                <Link
                  href="/dashboard/content"
                  className="shrink-0 inline-flex items-center gap-1 text-xs text-white/35 group-hover:text-orange-400/90 transition-colors"
                >
                  Content <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
