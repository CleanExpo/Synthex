'use client';

/**
 * Usage Dashboard — Phase 3 PR 2
 *
 * Shows the authenticated user's current-period consumption against their
 * plan limits. Four bars:
 *
 *   - Posts scheduled / aiPosts limit
 *   - AI generations (ApiUsage count, since period start)
 *   - Networks connected (active PlatformConnection rows)
 *   - Period reset date
 *
 * Visual pattern: Tailwind + Radix UI primitives (no new dependencies).
 *
 * @phase Synthex Phase 3 — Customer Self-Service
 * @mandate 493b042a-521c-44af-9cb2-43505593b65c
 */

import useSWR from 'swr';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchJson } from '@/lib/fetcher';
import { cn } from '@/lib/utils';
import {
  Calendar,
  Database,
  Sparkles,
  Globe,
} from '@/components/icons';

interface UsageResponse {
  plan: string;
  status: string;
  periodStart: string;
  periodResetAt: string;
  limits: {
    socialAccounts: number;
    aiPosts: number;
    personas: number;
  };
  usage: {
    aiPosts: number;
    aiGenerations: number;
    networksConnected: number;
  };
  authority?: {
    tier: 'free' | 'addon';
    limits: Record<string, number>;
  };
}

interface MetricBarProps {
  label: string;
  used: number;
  limit: number;
  Icon: React.ComponentType<{ className?: string }>;
  testId: string;
}

/**
 * Renders a usage bar. limit = -1 means unlimited (renders the "infinity"
 * indicator instead of a percentage).
 */
function MetricBar({ label, used, limit, Icon, testId }: MetricBarProps) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : limit === 0 ? 0 : Math.min(100, (used / limit) * 100);
  const danger = !unlimited && pct >= 90;
  const warn = !unlimited && pct >= 75 && pct < 90;

  return (
    <div data-testid={testId} className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-white/80">
          <Icon className="h-4 w-4 text-white/50" />
          <span>{label}</span>
        </div>
        <span
          className={cn(
            'text-xs tabular-nums',
            danger
              ? 'text-red-300'
              : warn
                ? 'text-amber-300'
                : 'text-white/60'
          )}
        >
          {unlimited ? (
            <span title="Unlimited">{used} / ∞</span>
          ) : (
            <span>
              {used} / {limit}
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 rounded-sm overflow-hidden bg-white/[0.04]">
        <div
          className={cn(
            'h-full transition-all',
            danger
              ? 'bg-red-500/60'
              : warn
                ? 'bg-amber-500/60'
                : 'bg-emerald-500/40'
          )}
          style={{ width: unlimited ? '100%' : `${pct}%` }}
          data-testid={`${testId}-bar`}
          data-pct={unlimited ? 'unlimited' : pct.toFixed(0)}
        />
      </div>
    </div>
  );
}

export default function UsagePage() {
  const { data, error, isLoading } = useSWR<UsageResponse>(
    '/api/billing/usage',
    fetchJson,
    {
      revalidateOnFocus: false,
      refreshInterval: 60 * 1000, // 1 min
    }
  );

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <div
          data-testid="usage-loading"
          className="h-64 rounded-sm border-[0.5px] border-white/[0.06] animate-pulse bg-white/[0.02]"
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <Card variant="glass">
          <CardContent className="py-8">
            <p
              data-testid="usage-error"
              className="text-sm text-red-300 text-center"
            >
              Unable to load usage data. Please refresh.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const resetDate = new Date(data.periodResetAt);
  const formattedReset = resetDate.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Usage</h1>
        <p className="text-sm text-white/60 mt-1">
          Your consumption against the{' '}
          <Badge variant="secondary" className="capitalize">
            {data.plan}
          </Badge>{' '}
          plan limits this period.
        </p>
      </header>

      <Card variant="glass">
        <CardHeader>
          <CardTitle>This period</CardTitle>
          <CardDescription>
            Resets{' '}
            <span data-testid="reset-date" className="font-medium text-white/80">
              {formattedReset}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-2">
          <MetricBar
            label="Posts scheduled"
            used={data.usage.aiPosts}
            limit={data.limits.aiPosts}
            Icon={Sparkles}
            testId="metric-posts"
          />
          <MetricBar
            label="AI generations"
            used={data.usage.aiGenerations}
            limit={data.limits.aiPosts}
            Icon={Database}
            testId="metric-ai-generations"
          />
          <MetricBar
            label="Networks connected"
            used={data.usage.networksConnected}
            limit={data.limits.socialAccounts}
            Icon={Globe}
            testId="metric-networks"
          />
          <div className="flex items-center gap-2 text-xs text-white/50 pt-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              Current period started{' '}
              {new Date(data.periodStart).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
