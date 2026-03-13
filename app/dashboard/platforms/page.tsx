'use client';

/**
 * Platform Management Hub
 *
 * Shows all social platforms with connection status, account details,
 * and quick actions (post, view analytics, disconnect).
 * Uses useSocialConnections SWR hook for all connection state.
 */

import { useState, useEffect, useCallback , Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DashboardSkeleton } from '@/components/skeletons';
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
import { useSocialConnections } from '@/hooks/use-social-connections';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatformInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly color: string;
  readonly bgColor: string;
  readonly borderColor: string;
  readonly dotColor: string;
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
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/20',
    dotColor: 'bg-sky-400',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Share professional content and articles',
    icon: Linkedin,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    dotColor: 'bg-blue-400',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Post photos, stories, reels, and carousels',
    icon: Instagram,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/20',
    dotColor: 'bg-pink-400',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    description: 'Manage pages and track performance',
    icon: Facebook,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    dotColor: 'bg-indigo-400',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Create and schedule short-form videos',
    icon: Video,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    dotColor: 'bg-rose-400',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Upload videos and manage your channel',
    icon: Video,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    dotColor: 'bg-red-400',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    description: 'Pin visual content and drive traffic',
    icon: Globe,
    color: 'text-red-300',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    dotColor: 'bg-red-300',
  },
  {
    id: 'reddit',
    name: 'Reddit',
    description: 'Engage communities and share content',
    icon: Globe,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    dotColor: 'bg-orange-400',
  },
  {
    id: 'threads',
    name: 'Threads',
    description: 'Post text updates and join conversations',
    icon: Globe,
    color: 'text-zinc-300',
    bgColor: 'bg-zinc-500/10',
    borderColor: 'border-zinc-500/20',
    dotColor: 'bg-zinc-300',
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
    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate">
        <span className="font-medium text-zinc-300">{value}</span>{' '}
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
}

function PlatformCard({ platform, status, onConnect, onDisconnect, onRefresh, connecting, disconnecting, refreshing }: PlatformCardProps) {
  const Icon = platform.icon;
  const tokenAlert = status.connected && (status.isExpired || status.needsRefresh);

  return (
    <Card className={`border ${tokenAlert ? 'border-amber-500/30' : platform.borderColor} bg-zinc-900/50 hover:bg-zinc-900/70 transition-colors`}>
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar when connected, platform icon otherwise */}
            {status.connected && status.avatar ? (
              <img
                src={status.avatar}
                alt={status.profileName || platform.name}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-white/10"
                onError={(e) => {
                  // Fall back to platform icon on broken avatar URL
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.removeAttribute('style');
                }}
              />
            ) : null}
            <div
              className={`p-2.5 rounded-lg ${platform.bgColor}`}
              style={status.connected && status.avatar ? { display: 'none' } : undefined}
            >
              <Icon className={`h-5 w-5 ${platform.color}`} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold text-white">
                {platform.name}
              </CardTitle>
              {status.connected && status.profileName ? (
                <p className="text-xs text-zinc-400 truncate mt-0.5">
                  @{status.profileName}
                </p>
              ) : (
                <p className="text-xs text-zinc-500 truncate mt-0.5">
                  {platform.description}
                </p>
              )}
            </div>
          </div>

          {/* Status badge — shows token warning when applicable */}
          {status.connected && status.isExpired ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertTriangle className="h-3 w-3" />
              Expired
            </span>
          ) : status.connected && status.needsRefresh ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertCircle className="h-3 w-3" />
              Needs refresh
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                status.connected
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/30'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${status.connected ? 'bg-green-400' : 'bg-zinc-600'}`} />
              {status.connected ? 'Connected' : 'Not connected'}
            </span>
          )}
        </div>

        {/* Token refresh prompt */}
        {tokenAlert && (
          <div className="mt-2 flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
            <p className="text-[11px] text-amber-400/80">
              {status.isExpired
                ? 'Access token expired — reconnect to continue publishing.'
                : 'Token will expire soon. Refresh now to avoid interruptions.'}
            </p>
            <button
              onClick={() => onRefresh(platform.id)}
              disabled={refreshing}
              className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors disabled:opacity-50"
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
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {status.connected ? (
          <>
            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-2 py-2 px-3 rounded-lg bg-zinc-800/30 border border-zinc-700/20">
              {status.followers !== undefined && (
                <MiniStat icon={Users} label="followers" value={formatNumber(status.followers)} />
              )}
              {status.postsThisWeek !== undefined && (
                <MiniStat icon={Send} label="posts (7d)" value={String(status.postsThisWeek)} />
              )}
              {status.engagementRate !== undefined && (
                <MiniStat icon={Heart} label="engage" value={`${status.engagementRate.toFixed(1)}%`} />
              )}
              {status.lastPostDate && (
                <MiniStat
                  icon={Eye}
                  label="last post"
                  value={new Date(status.lastPostDate).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                />
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Link
                href="/dashboard/content"
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium text-white bg-violet-600/80 hover:bg-violet-600 rounded-md transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
                Create Post
              </Link>
              <Link
                href="/dashboard/analytics"
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-md transition-colors"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Analytics
              </Link>
              <button
                onClick={() => onDisconnect(platform.id)}
                disabled={disconnecting}
                title="Disconnect"
                aria-label={`Disconnect ${platform.name}`}
                className="inline-flex items-center justify-center h-8 w-8 text-zinc-400 hover:text-red-400 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          /* Not connected — CTA */
          <Button
            onClick={() => onConnect(platform.id)}
            disabled={connecting}
            className="w-full bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/50 transition-colors"
            size="sm"
          >
            {connecting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Link2 className="h-3.5 w-3.5 mr-2" />
                Connect {platform.name}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Summary stats
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
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="bg-zinc-900/50 border border-zinc-800/50">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <CheckCircle className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{connectedCount}</p>
            <p className="text-xs text-zinc-500">Connected</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-zinc-900/50 border border-zinc-800/50">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-500/10">
            <AlertCircle className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{PLATFORMS.length - connectedCount}</p>
            <p className="text-xs text-zinc-500">Available</p>
          </div>
        </CardContent>
      </Card>
      <Card className={`border ${needsAttention ? 'border-amber-500/20 bg-amber-500/5' : 'bg-zinc-900/50 border-zinc-800/50'}`}>
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`p-2 rounded-lg ${needsAttention ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}>
            {needsAttention ? (
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            ) : (
              <Users className="h-5 w-5 text-blue-400" />
            )}
          </div>
          <div>
            {needsAttention ? (
              <>
                <p className="text-2xl font-bold text-amber-400">{needsAttention}</p>
                <p className="text-xs text-zinc-500">Need attention</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-white">{formatNumber(totalFollowers)}</p>
                <p className="text-xs text-zinc-500">Total Reach</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      <Card className="bg-zinc-900/50 border border-zinc-800/50">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10">
            <TrendingUp className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">
              {avgEngagement > 0 ? `${avgEngagement.toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs text-zinc-500">Avg Engagement</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function PlatformsPageContent() {
  const { activeOrganizationId } = useActiveBusiness();
  const { connections, summary, isLoading, connect, disconnect, mutate } = useSocialConnections(activeOrganizationId);
  const searchParams = useSearchParams();
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Map hook connections to a lookup by platform id
  const connectionMap = new Map(connections.map((c) => [c.platform, c]));

  // Show success toast when redirected back after OAuth
  useEffect(() => {
    const connected = searchParams.get('connected');
    if (connected) {
      toast.success(`Connected to ${connected}!`);
      // Clean up the URL param without full page reload
      const url = new URL(window.location.href);
      url.searchParams.delete('connected');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  const handleConnect = useCallback(async (platformId: string) => {
    setConnectingId(platformId);
    try {
      await connect(platformId);
      // connect() redirects to OAuth provider — no further action needed here
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to connect ${platformId}`;
      toast.error(message);
      setConnectingId(null);
    }
    // Note: setConnectingId(null) NOT called on success — page navigates away
  }, [connect]);

  const handleDisconnect = useCallback(async (platformId: string) => {
    setDisconnectingId(platformId);
    try {
      await disconnect(platformId);
      toast.success(`Disconnected from ${platformId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to disconnect ${platformId}`;
      toast.error(message);
    } finally {
      setDisconnectingId(null);
    }
  }, [disconnect]);

  const handleRefresh = useCallback(async (platformId: string) => {
    setRefreshingId(platformId);
    try {
      const res = await fetch('/api/auth/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ platform: platformId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to refresh ${platformId} token`);
      }
      toast.success(`${platformId} token refreshed`);
      await mutate();
    } catch (err) {
      const message = err instanceof Error ? err.message : `Refresh failed for ${platformId}`;
      toast.error(message);
    } finally {
      setRefreshingId(null);
    }
  }, [mutate]);

  // Build platform status for each known platform
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

  const connectedPlatforms = PLATFORMS.filter((p) => connectionMap.get(p.id)?.connected);
  const availablePlatforms = PLATFORMS.filter((p) => !connectionMap.get(p.id)?.connected);
  const connectedCount = connectedPlatforms.length;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platforms"
        description="Manage your connected social media accounts and monitor performance."
        actions={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => mutate()}
              className="text-zinc-400 hover:text-white border border-zinc-700/50 hover:bg-zinc-800/50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Link href="/dashboard/integrations">
              <Button
                size="sm"
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                <Link2 className="h-4 w-4 mr-2" />
                Manage Connections
              </Button>
            </Link>
          </div>
        }
      />

      {/* Summary stats */}
      <PlatformSummary
        connectedCount={connectedCount}
        totalFollowers={0}
        avgEngagement={0}
        needsAttention={summary?.needsAttention ?? 0}
      />

      {/* Empty state — no platforms connected */}
      {summary?.connected === 0 && !isLoading && (
        <div className="text-center py-12 rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
          <p className="text-slate-400 text-sm font-medium">No platforms connected yet</p>
          <p className="text-slate-500 text-xs mt-1">
            Click &ldquo;Connect&rdquo; on any platform card below to get started.
          </p>
        </div>
      )}

      {/* Connected platforms */}
      {connectedPlatforms.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
            Connected Platforms
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectedPlatforms.map((platform) => (
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
              />
            ))}
          </div>
        </div>
      )}

      {/* Available platforms */}
      {availablePlatforms.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
            Available Platforms
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availablePlatforms.map((platform) => (
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
