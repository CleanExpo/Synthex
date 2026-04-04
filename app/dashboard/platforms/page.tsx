'use client';

/**
 * Platform Management Hub
 *
 * Shows all social platforms with connection status, account details,
 * and quick actions (post, view analytics, disconnect).
 * Uses useSocialConnections SWR hook for all connection state.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/page-header';
import {
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Video,
  Globe,
  Link2,
  Unlink,
  RefreshCw,
  Send,
  BarChart3,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Loader2,
  TrendingUp,
  Users,
  Eye,
  Heart,
} from '@/components/icons';
import { toast } from 'sonner';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useSocialConnections } from '@/hooks/use-social-connections';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatformInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
  readonly accentColour: string;
}

interface PlatformStatus {
  connected: boolean;
  profileName?: string;
  avatar?: string;
  lastPostDate?: string;
  followers?: number;
  postsThisWeek?: number;
  engagementRate?: number;
  isExpired?: boolean;
  needsRefresh?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORMS: PlatformInfo[] = [
  {
    id: 'twitter',
    name: 'Twitter / X',
    description: 'Post tweets, threads, and track engagement',
    icon: Twitter,
    accentColour: '#38BDF8',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Share professional content and articles',
    icon: Linkedin,
    accentColour: '#60A5FA',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Post photos, stories, reels, and carousels',
    icon: Instagram,
    accentColour: '#F472B6',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    description: 'Manage pages and track performance',
    icon: Facebook,
    accentColour: '#818CF8',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Create and schedule short-form videos',
    icon: Video,
    accentColour: '#FB7185',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Upload videos and manage your channel',
    icon: Video,
    accentColour: '#F87171',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    description: 'Pin visual content and drive traffic',
    icon: Globe,
    accentColour: '#FCA5A5',
  },
  {
    id: 'reddit',
    name: 'Reddit',
    description: 'Engage communities and share content',
    icon: Globe,
    accentColour: '#FB923C',
  },
  {
    id: 'threads',
    name: 'Threads',
    description: 'Post text updates and join conversations',
    icon: Globe,
    accentColour: '#A1A1AA',
  },
  {
    id: 'googleanalytics',
    name: 'Google Analytics',
    description: 'Track website traffic, conversions, and ROI attribution',
    icon: BarChart3,
    accentColour: '#F59E0B',
  },
];

// ---------------------------------------------------------------------------
// Stat helper
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ---------------------------------------------------------------------------
// MiniStat
// ---------------------------------------------------------------------------

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-white/60">
      <Icon className="h-3 w-3 flex-shrink-0" />
      <span className="truncate">
        <span className="font-mono text-white/60 tabular-nums">{value}</span>{' '}
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlatformCard
// ---------------------------------------------------------------------------

interface PlatformCardProps {
  platform: PlatformInfo;
  status: PlatformStatus;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onRefresh: (id: string) => void;
  connecting: boolean;
  disconnecting: boolean;
  refreshing: boolean;
  highlighted?: boolean;
}

function PlatformCard({
  platform,
  status,
  onConnect,
  onDisconnect,
  onRefresh,
  connecting,
  disconnecting,
  refreshing,
  highlighted,
}: PlatformCardProps) {
  const Icon = platform.icon;
  const tokenAlert =
    status.connected && (status.isExpired || status.needsRefresh);

  return (
    <div
      id={`platform-${platform.id}`}
      className={cn(
        'border-[0.5px] rounded-sm overflow-hidden bg-white/[0.01] hover:bg-white/[0.02] transition-colors',
        tokenAlert
          ? 'border-orange-500/20'
          : highlighted
            ? 'border-amber-400/50 ring-1 ring-amber-400/30'
            : 'border-white/[0.06]'
      )}
    >
      {/* Card header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar or icon */}
            {status.connected && status.avatar ? (
              <img
                src={status.avatar}
                alt={status.profileName || platform.name}
                className="h-9 w-9 rounded-sm object-cover border-[0.5px] border-white/[0.1]"
                onError={e => {
                  e.currentTarget.style.display = 'none';
                  (
                    e.currentTarget.nextElementSibling as HTMLElement | null
                  )?.removeAttribute('style');
                }}
              />
            ) : null}
            <div
              className="h-9 w-9 border-[0.5px] border-white/[0.06] bg-white/[0.02] rounded-sm flex items-center justify-center flex-shrink-0"
              style={
                status.connected && status.avatar
                  ? { display: 'none' }
                  : undefined
              }
            >
              <Icon
                className="h-4 w-4"
                style={{ color: platform.accentColour }}
              />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-light text-white tracking-tight">
                {platform.name}
              </p>
              {status.connected && status.profileName ? (
                <p className="text-[10px] text-white/60 truncate mt-0.5">
                  @{status.profileName}
                </p>
              ) : (
                <p className="text-[10px] text-white/50 truncate mt-0.5">
                  {platform.description}
                </p>
              )}
            </div>
          </div>

          {/* Status badge */}
          {status.connected && status.isExpired ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[9px] uppercase tracking-[0.15em] bg-red-500/[0.08] text-red-400 border-[0.5px] border-red-500/20 shrink-0">
              <AlertTriangle className="h-2.5 w-2.5" />
              Expired
            </span>
          ) : status.connected && status.needsRefresh ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[9px] uppercase tracking-[0.15em] bg-orange-500/[0.08] text-orange-400 border-[0.5px] border-orange-500/20 shrink-0">
              <AlertCircle className="h-2.5 w-2.5" />
              Refresh
            </span>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[9px] uppercase tracking-[0.15em] border-[0.5px] shrink-0',
                status.connected
                  ? 'bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/20'
                  : 'bg-white/[0.02] text-white/50 border-white/[0.06]'
              )}
            >
              <span
                className={cn(
                  'h-1 w-1 rounded-full',
                  status.connected ? 'bg-emerald-400' : 'bg-white/20'
                )}
              />
              {status.connected ? 'Connected' : 'Not connected'}
            </span>
          )}
        </div>

        {/* Token alert banner */}
        {tokenAlert && (
          <div className="mt-2.5 flex items-center justify-between gap-2 px-3 py-2 rounded-sm bg-orange-500/[0.05] border-[0.5px] border-orange-500/15">
            <p className="text-[10px] text-orange-400/80">
              {status.isExpired
                ? 'Access token expired — reconnect to continue publishing.'
                : 'Token will expire soon. Refresh to avoid interruptions.'}
            </p>
            <button
              onClick={() => onRefresh(platform.id)}
              disabled={refreshing}
              className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] text-orange-400 hover:text-white bg-orange-500/[0.08] hover:bg-orange-500/20 border-[0.5px] border-orange-500/20 transition-colors disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="px-4 pb-4 space-y-3">
        {status.connected ? (
          <>
            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-1.5 py-2 px-3 rounded-sm bg-white/[0.02] border-[0.5px] border-white/[0.04]">
              {status.followers !== undefined && (
                <MiniStat
                  icon={Users}
                  label="followers"
                  value={formatNumber(status.followers)}
                />
              )}
              {status.postsThisWeek !== undefined && (
                <MiniStat
                  icon={Send}
                  label="posts (7d)"
                  value={String(status.postsThisWeek)}
                />
              )}
              {status.engagementRate !== undefined && (
                <MiniStat
                  icon={Heart}
                  label="engage"
                  value={`${status.engagementRate.toFixed(1)}%`}
                />
              )}
              {status.lastPostDate && (
                <MiniStat
                  icon={Eye}
                  label="last post"
                  value={new Date(status.lastPostDate).toLocaleDateString(
                    'en-AU',
                    {
                      month: 'short',
                      day: 'numeric',
                    }
                  )}
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Link
                href="/dashboard/content"
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium rounded-sm transition-colors bg-orange-500 hover:bg-orange-400 text-[#050505]"
              >
                <Send className="h-3.5 w-3.5" />
                Create Post
              </Link>
              <Link
                href="/dashboard/analytics"
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs text-white/50 hover:text-white/80 border-[0.5px] border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] rounded-sm transition-colors"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Analytics
              </Link>
              <button
                onClick={() => onDisconnect(platform.id)}
                disabled={disconnecting}
                title="Disconnect"
                aria-label={`Disconnect ${platform.name}`}
                className="inline-flex items-center justify-center h-8 w-8 text-white/50 hover:text-red-400 border-[0.5px] border-white/[0.06] bg-white/[0.01] hover:bg-red-500/[0.05] rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {disconnecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unlink className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => onConnect(platform.id)}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 h-8 text-xs font-medium rounded-sm transition-colors border-[0.5px] border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-white/50 hover:text-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connecting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <Link2 className="h-3.5 w-3.5" />
                Connect {platform.name}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary stats — horizontal data strip
// ---------------------------------------------------------------------------

function PlatformSummary({
  connectedCount,
  totalFollowers,
  avgEngagement,
  needsAttention,
}: {
  connectedCount: number;
  totalFollowers: number;
  avgEngagement: number;
  needsAttention?: number;
}) {
  const items = [
    {
      label: 'Connected',
      value: String(connectedCount),
      colour: '#00FF88',
      icon: CheckCircle,
    },
    {
      label: 'Available',
      value: String(PLATFORMS.length - connectedCount),
      colour: '#6B7280',
      icon: AlertCircle,
    },
    {
      label: 'Total Reach',
      value: needsAttention
        ? String(needsAttention)
        : formatNumber(totalFollowers),
      colour: needsAttention ? '#FFB800' : '#6B7280',
      icon: needsAttention ? AlertTriangle : Users,
    },
    {
      label: 'Avg Engagement',
      value: avgEngagement > 0 ? `${avgEngagement.toFixed(1)}%` : '—',
      colour: '#00F5FF',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="px-5 py-4 flex flex-col gap-1.5 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Icon className="h-3 w-3 text-white/50" />
                <span className="text-[9px] uppercase tracking-[0.2em] text-white/50">
                  {item.label}
                </span>
              </div>
              <span
                className="font-mono text-2xl font-medium tabular-nums leading-none"
                style={{ color: item.colour }}
              >
                {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function PlatformsPageContent() {
  const { activeOrganizationId } = useActiveBusiness();
  const { connections, summary, isLoading, connect, disconnect, mutate } =
    useSocialConnections(activeOrganizationId);
  const searchParams = useSearchParams();
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const connectionMap = new Map(connections.map(c => [c.platform, c]));
  const highlightId = searchParams.get('highlight') ?? null;

  useEffect(() => {
    const connected = searchParams.get('connected');
    if (connected) {
      toast.success(`Connected to ${connected}!`);
      const url = new URL(window.location.href);
      url.searchParams.delete('connected');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  // Scroll highlighted platform card into view after load
  useEffect(() => {
    if (!highlightId || isLoading) return;
    const el = document.getElementById(`platform-${highlightId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId, isLoading]);

  const handleConnect = useCallback(
    async (platformId: string) => {
      setConnectingId(platformId);
      try {
        await connect(platformId);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : `Failed to connect ${platformId}`;
        toast.error(message);
        setConnectingId(null);
      }
    },
    [connect]
  );

  const handleDisconnect = useCallback(
    async (platformId: string) => {
      setDisconnectingId(platformId);
      try {
        await disconnect(platformId);
        toast.success(`Disconnected from ${platformId}`);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : `Failed to disconnect ${platformId}`;
        toast.error(message);
      } finally {
        setDisconnectingId(null);
      }
    },
    [disconnect]
  );

  const handleRefresh = useCallback(
    async (platformId: string) => {
      setRefreshingId(platformId);
      try {
        const res = await fetch('/api/auth/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ platform: platformId }),
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(
            data.error || `Failed to refresh ${platformId} token`
          );
        toast.success(`${platformId} token refreshed`);
        await mutate();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : `Refresh failed for ${platformId}`;
        toast.error(message);
      } finally {
        setRefreshingId(null);
      }
    },
    [mutate]
  );

  const buildStatus = (platformId: string): PlatformStatus => {
    const conn = connectionMap.get(platformId);
    if (!conn?.connected) return { connected: false };
    return {
      connected: true,
      profileName: conn.username,
      avatar: conn.avatar,
      isExpired: conn.isExpired,
      needsRefresh: conn.needsRefresh,
    };
  };

  const connectedPlatforms = PLATFORMS.filter(
    p => connectionMap.get(p.id)?.connected
  );
  const availablePlatforms = PLATFORMS.filter(
    p => !connectionMap.get(p.id)?.connected
  );
  const connectedCount = connectedPlatforms.length;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-2 w-20 bg-white/[0.04] rounded-sm" />
          <div className="h-9 w-40 bg-white/[0.06] rounded-sm" />
          <div className="h-px bg-white/[0.06] mt-5" />
        </div>
        <div className="h-20 bg-white/[0.03] border-[0.5px] border-white/[0.06] rounded-sm" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-36 bg-white/[0.02] border-[0.5px] border-white/[0.04] rounded-sm"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Social Media"
        title="Platforms"
        description="Manage your connected social media accounts and monitor performance."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => mutate()}
              className="flex items-center gap-2 px-3 py-2 border-[0.5px] border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] rounded-sm text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <Link href="/dashboard/integrations">
              <span className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-[#050505] text-xs font-semibold tracking-wide rounded-sm transition-colors cursor-pointer">
                <Link2 className="h-3.5 w-3.5" />
                Manage Connections
              </span>
            </Link>
          </div>
        }
      />

      {/* Summary data strip */}
      <PlatformSummary
        connectedCount={connectedCount}
        totalFollowers={0}
        avgEngagement={0}
        needsAttention={summary?.needsAttention ?? 0}
      />

      {/* Empty state */}
      {summary?.connected === 0 && !isLoading && (
        <div className="py-12 border-[0.5px] border-dashed border-white/[0.08] rounded-sm text-center">
          <p className="text-sm font-light text-white/40">
            No platforms connected yet
          </p>
          <p className="text-xs text-white/50 mt-1">
            Click &ldquo;Connect&rdquo; on any platform card below to get
            started.
          </p>
        </div>
      )}

      {/* Connected platforms */}
      {connectedPlatforms.length > 0 && (
        <div className="space-y-3">
          <span className="text-[9px] uppercase tracking-[0.25em] text-white/50">
            Connected Platforms
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {connectedPlatforms.map(platform => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                status={buildStatus(platform.id)}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onRefresh={handleRefresh}
                connecting={connectingId === platform.id}
                disconnecting={disconnectingId === platform.id}
                refreshing={refreshingId === platform.id}
                highlighted={highlightId === platform.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available platforms */}
      {availablePlatforms.length > 0 && (
        <div className="space-y-3">
          <span className="text-[9px] uppercase tracking-[0.25em] text-white/50">
            Available Platforms
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availablePlatforms.map(platform => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                status={buildStatus(platform.id)}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onRefresh={handleRefresh}
                connecting={connectingId === platform.id}
                disconnecting={disconnectingId === platform.id}
                refreshing={refreshingId === platform.id}
                highlighted={highlightId === platform.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlatformsPage() {
  return (
    <Suspense>
      <PlatformsPageContent />
    </Suspense>
  );
}
