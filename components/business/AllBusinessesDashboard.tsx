'use client';

/**
 * All Businesses Dashboard
 *
 * Shown on the main dashboard when a Scale Enterprise user is in
 * "All Businesses" mode (activeOrganizationId === null).
 *
 * Fetches /api/businesses?stats=true and renders:
 *  - Aggregate summary row (total businesses, campaigns, posts, engagement)
 *  - Per-business card with key stats + action buttons
 */

import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import {
  Building2,
  BarChart,
  Briefcase,
  Globe,
  ArrowRight,
  TrendingUp,
  Zap,
  Sparkles,
  Loader2,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BusinessStats {
  totalCampaigns: number;
  totalPosts: number;
  activePlatforms: number;
  totalEngagement: number;
}

interface OwnedBusiness {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  displayName: string | null;
  isActive: boolean;
  billingStatus: string;
  monthlyRate: number;
  stats?: BusinessStats;
}

interface BusinessesResponse {
  businesses: OwnedBusiness[];
  activeBusiness: string | null;
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch businesses');
    return r.json();
  });

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function billingBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':      return 'bg-green-500/10 text-green-400 border-green-500/20';
    case 'past_due':    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'cancelled':   return 'bg-red-500/10 text-red-400 border-red-500/20';
    default:            return 'bg-white/[0.05] text-gray-400 border-white/10';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AllBusinessesDashboard() {
  const router = useRouter();
  const { switchBusiness } = useActiveBusiness();

  const { data, isLoading } = useSWR<BusinessesResponse>(
    '/api/businesses?stats=true',
    fetchJson,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="h-8 w-56 rounded-lg bg-white/[0.05] animate-pulse" />
        {/* Aggregate bar skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-white/[0.04] animate-pulse" />
          ))}
        </div>
        {/* Business cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const businesses = data?.businesses ?? [];

  if (businesses.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center space-y-3">
        <Building2 className="h-10 w-10 text-gray-500 mx-auto" />
        <p className="text-sm text-gray-400">No businesses found on your account.</p>
        <Button
          size="sm"
          variant="outline"
          className="border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10"
          onClick={() => router.push('/dashboard/businesses')}
        >
          Manage Businesses
        </Button>
      </div>
    );
  }

  // ── Aggregate stats ────────────────────────────────────────────────────────
  const totalCampaigns   = businesses.reduce((s, b) => s + (b.stats?.totalCampaigns   ?? 0), 0);
  const totalPosts       = businesses.reduce((s, b) => s + (b.stats?.totalPosts       ?? 0), 0);
  const totalEngagement  = businesses.reduce((s, b) => s + (b.stats?.totalEngagement  ?? 0), 0);
  const activePlatforms  = businesses.reduce((s, b) => s + (b.stats?.activePlatforms  ?? 0), 0);

  // ── Generate content for a business ───────────────────────────────────────
  const handleGenerateContent = async (orgId: string, name: string) => {
    try {
      await switchBusiness(orgId);
      router.push('/dashboard/content');
    } catch {
      toast.error(`Could not switch to ${name}. Please try again.`);
    }
  };

  // ── Switch to a business ───────────────────────────────────────────────────
  const handleSwitch = async (orgId: string, name: string) => {
    try {
      await switchBusiness(orgId);
      toast.success(`Switched to ${name}`, {
        description: 'Dashboard is now showing data for this business.',
      });
      router.refresh();
    } catch {
      toast.error(`Could not switch to ${name}. Please try again.`);
    }
  };

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20">
            <Building2 className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">All Businesses</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Scale Enterprise — {businesses.length} business{businesses.length !== 1 ? 'es' : ''} managed
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 text-xs h-7"
          onClick={() => router.push('/dashboard/businesses')}
        >
          Manage
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>

      {/* ── Aggregate stats row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Businesses',  value: businesses.length,         icon: Building2,  colour: 'text-cyan-400',   bg: 'bg-cyan-500/10'   },
          { label: 'Campaigns',   value: totalCampaigns,            icon: Briefcase,  colour: 'text-violet-400', bg: 'bg-violet-500/10' },
          { label: 'Posts',       value: totalPosts,                icon: BarChart,   colour: 'text-blue-400',   bg: 'bg-blue-500/10'   },
          { label: 'Engagement',  value: formatNumber(totalEngagement), icon: TrendingUp, colour: 'text-green-400',  bg: 'bg-green-500/10'  },
        ].map(({ label, value, icon: Icon, colour, bg }) => (
          <div
            key={label}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 flex flex-col gap-2"
          >
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', bg)}>
              <Icon className={cn('h-4 w-4', colour)} />
            </div>
            <div>
              <p className="text-xl font-bold text-white leading-none">{value}</p>
              <p className="text-[11px] text-gray-500 mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Per-business cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {businesses.map((business) => {
          const displayName = business.displayName ?? business.organizationName;
          const stats = business.stats;

          return (
            <div
              key={business.id}
              className={cn(
                'rounded-xl border p-4 space-y-4 transition-colors',
                business.isActive
                  ? 'border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-blue-500/5'
                  : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14]'
              )}
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    business.isActive ? 'bg-cyan-500/20' : 'bg-white/[0.06]'
                  )}>
                    <Building2 className={cn('h-4 w-4', business.isActive ? 'text-cyan-400' : 'text-gray-400')} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                    <p className="text-[10px] text-gray-500 truncate">{business.organizationSlug}</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn('text-[10px] px-1.5 py-0 shrink-0', billingBadgeClass(business.billingStatus))}
                >
                  {business.billingStatus === 'past_due' ? 'Past due' : business.billingStatus}
                </Badge>
              </div>

              {/* Stats mini-grid */}
              {stats && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Campaigns',  value: stats.totalCampaigns,                  icon: Briefcase  },
                    { label: 'Posts',      value: stats.totalPosts,                      icon: BarChart   },
                    { label: 'Platforms',  value: stats.activePlatforms,                 icon: Globe      },
                    { label: 'Engagement', value: formatNumber(stats.totalEngagement),   icon: TrendingUp },
                  ].map(({ label, value, icon: Icon }) => (
                    <div
                      key={label}
                      className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-2.5 py-2 flex items-center gap-2"
                    >
                      <Icon className="h-3 w-3 text-gray-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white">{value}</p>
                        <p className="text-[10px] text-gray-500">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/30 transition-all"
                  onClick={() => handleGenerateContent(business.organizationId, displayName)}
                >
                  <Sparkles className="h-3 w-3 mr-1.5" />
                  Generate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-gray-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.08] px-3"
                  onClick={() => handleSwitch(business.organizationId, displayName)}
                >
                  Switch
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer link ──────────────────────────────────────────────────────── */}
      <p className="text-center text-xs text-gray-500">
        {activePlatforms} platform connection{activePlatforms !== 1 ? 's' : ''} active across all businesses ·{' '}
        <button
          className="text-cyan-500 hover:text-cyan-400 transition-colors"
          onClick={() => router.push('/dashboard/businesses')}
        >
          Manage all businesses →
        </button>
      </p>

    </div>
  );
}
