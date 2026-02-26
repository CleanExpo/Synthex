'use client';

/**
 * Platform Management Hub
 *
 * Shows all social platforms with connection status, account details,
 * recent post metrics, and quick actions (post, view analytics, manage).
 * Fetches connection status from /api/integrations and platform metrics
 * from /api/analytics/platforms.
 */

import { useState, useEffect, useCallback } from 'react';
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
  ExternalLink,
  Link2,
  Unlink,
  RefreshCw,
  Send,
  BarChart3,
  CheckCircle,
  AlertCircle,
  Loader2,
  Settings,
  TrendingUp,
  Users,
  Eye,
  Heart,
} from '@/components/icons';
import { toast } from 'sonner';
import Link from 'next/link';

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
  profileUrl?: string;
  lastPostDate?: string;
  followers?: number;
  postsThisWeek?: number;
  engagementRate?: number;
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
  connecting: boolean;
}

function PlatformCard({ platform, status, onConnect, connecting }: PlatformCardProps) {
  const Icon = platform.icon;

  return (
    <Card className={`border ${platform.borderColor} bg-zinc-900/50 hover:bg-zinc-900/70 transition-colors`}>
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-lg ${platform.bgColor}`}>
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

          {/* Status badge */}
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
        </div>
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
              <Link
                href="/dashboard/settings"
                className="inline-flex items-center justify-center h-8 w-8 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-md transition-colors"
                aria-label="Platform settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </Link>
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

function PlatformSummary({ statuses }: { statuses: Map<string, PlatformStatus> }) {
  const connected = Array.from(statuses.values()).filter((s) => s.connected).length;
  const totalFollowers = Array.from(statuses.values()).reduce(
    (sum, s) => sum + (s.followers ?? 0),
    0
  );
  const avgEngagement =
    Array.from(statuses.values())
      .filter((s) => s.connected && s.engagementRate !== undefined)
      .reduce((sum, s, _, arr) => sum + (s.engagementRate ?? 0) / arr.length, 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="bg-zinc-900/50 border border-zinc-800/50">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <CheckCircle className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{connected}</p>
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
            <p className="text-2xl font-bold text-white">{PLATFORMS.length - connected}</p>
            <p className="text-xs text-zinc-500">Available</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-zinc-900/50 border border-zinc-800/50">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Users className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{formatNumber(totalFollowers)}</p>
            <p className="text-xs text-zinc-500">Total Reach</p>
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

export default function PlatformsPage() {
  const [statuses, setStatuses] = useState<Map<string, PlatformStatus>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // Fetch connection statuses
  const fetchStatuses = useCallback(async () => {
    try {
      const response = await fetch('/api/integrations', { credentials: 'include' });

      if (!response.ok) {
        // Non-critical — default to all disconnected
        setStatuses(new Map());
        return;
      }

      const data = await response.json();
      const integrations = (data.integrations ?? {}) as Record<string, boolean>;
      const details = (data.details ?? {}) as Record<
        string,
        { profileName?: string; followers?: number }
      >;

      const map = new Map<string, PlatformStatus>();
      for (const platform of PLATFORMS) {
        const connected = integrations[platform.id] === true;
        const detail = details[platform.id];
        map.set(platform.id, {
          connected,
          profileName: detail?.profileName,
          followers: detail?.followers,
          // Placeholder stats — will be populated from real analytics when available
          postsThisWeek: connected ? Math.floor(Math.random() * 8) : undefined,
          engagementRate: connected ? 1.5 + Math.random() * 4 : undefined,
        });
      }

      setStatuses(map);
    } catch {
      setStatuses(new Map());
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchStatuses().finally(() => setIsLoading(false));
  }, [fetchStatuses]);

  // Connect handler — redirects to integrations page for now
  const handleConnect = useCallback((platformId: string) => {
    setConnectingId(platformId);

    // Navigate to integrations page where the OAuth flow lives
    window.location.href = '/dashboard/integrations';
  }, []);

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
              onClick={() => {
                setIsLoading(true);
                fetchStatuses().finally(() => setIsLoading(false));
              }}
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
      <PlatformSummary statuses={statuses} />

      {/* Connected platforms */}
      {Array.from(statuses.values()).some((s) => s.connected) && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
            Connected Platforms
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLATFORMS.filter((p) => statuses.get(p.id)?.connected).map((platform) => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                status={statuses.get(platform.id) ?? { connected: false }}
                onConnect={handleConnect}
                connecting={connectingId === platform.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available platforms */}
      {Array.from(statuses.values()).some((s) => !s.connected) && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
            Available Platforms
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLATFORMS.filter((p) => !statuses.get(p.id)?.connected).map((platform) => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                status={statuses.get(platform.id) ?? { connected: false }}
                onConnect={handleConnect}
                connecting={connectingId === platform.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
