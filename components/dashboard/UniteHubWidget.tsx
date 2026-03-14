'use client';

/**
 * Unite-Group Connection Widget
 *
 * Dashboard glass card showing the real-time health of the Unite-Group Nexus
 * API connection. Owner-only — returns null for non-owners.
 *
 * Features:
 * - Live connection status indicator (green / amber / gray)
 * - Pull endpoint URL with one-click copy (for Unite-Group config)
 * - Event type badges (8 types Synthex pushes)
 * - "Test Connection" button — fires a live ping and shows latency
 * - "Open Unite-Group" external link
 *
 * Data: SWR → GET /api/unite-hub/status (60s dedup, no focus revalidate)
 */

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Building2, Copy, Zap, Loader2, ExternalLink } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConnectionStatusBadge, type ConnectionState } from '@/components/realtime/ConnectionStatus';
import { cn } from '@/lib/utils';
import { useUser } from '@/hooks/use-user';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UniteHubStatusResponse {
  configured: boolean;
  reachable: boolean;
  domain: string | null;
  pullEndpoint: string;
  eventTypes: string[];
}

interface TestResult {
  success: boolean;
  latencyMs?: number;
  error?: string;
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

// ── Component ─────────────────────────────────────────────────────────────────

export function UniteHubWidget({ className }: { className?: string }) {
  const { user } = useUser();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const { data, isLoading, mutate } = useSWR<UniteHubStatusResponse>(
    '/api/unite-hub/status',
    fetchJson,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  // ── Owner gate ─────────────────────────────────────────────────────────────
  // isMultiBusinessOwner is used as the owner flag across the dashboard
  if (!user?.isMultiBusinessOwner) return null;

  // ── Derive connection state ────────────────────────────────────────────────
  const connectionState: ConnectionState = !data?.configured
    ? 'disconnected'
    : data.reachable
    ? 'connected'
    : 'reconnecting'; // amber — configured but server unreachable

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCopy = async () => {
    if (!data?.pullEndpoint) return;
    try {
      await navigator.clipboard.writeText(data.pullEndpoint);
      toast.success('Copied to clipboard', {
        description: 'Paste this URL into your Unite-Group Nexus settings.',
      });
    } catch {
      toast.error('Could not copy — please copy manually.');
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/unite-hub/status', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json() as TestResult;
      setTestResult(json);
      // Revalidate so the status dot reflects the latest reachability
      await mutate();
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card variant="glass" className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Building2 className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <Card variant="glass" className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 shrink-0">
              <Building2 className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <CardTitle className="text-base">Unite-Group</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Nexus Dashboard Integration
              </CardDescription>
            </div>
          </div>
          <ConnectionStatusBadge state={connectionState} />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">

        {/* Pull Endpoint */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-400">
            Pull Endpoint{' '}
            <span className="text-gray-600 font-normal">(configure in Unite-Group)</span>
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 font-mono text-[11px] text-cyan-300 bg-white/[0.04] border border-white/[0.08] rounded-md px-2.5 py-1.5 truncate">
              {data?.pullEndpoint ?? '—'}
            </code>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08]"
              onClick={handleCopy}
              aria-label="Copy pull endpoint"
            >
              <Copy className="h-3.5 w-3.5 text-gray-400" />
            </Button>
          </div>
        </div>

        {/* Event Types */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-400">Events sent to Unite-Group</p>
          <div className="flex flex-wrap gap-1.5">
            {(data?.eventTypes ?? []).map((type) => (
              <Badge
                key={type}
                variant="glass"
                className="text-[10px] px-1.5 py-0 font-mono"
              >
                {type}
              </Badge>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button
            size="sm"
            className="w-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/30 transition-all"
            onClick={handleTest}
            disabled={isTesting || !data?.configured}
          >
            {isTesting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Testing connection…
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5 mr-2" />
                Test Connection
              </>
            )}
          </Button>

          {/* Test result */}
          {testResult && (
            <p className={cn(
              'text-[11px] text-center',
              testResult.success ? 'text-green-400' : 'text-red-400'
            )}>
              {testResult.success
                ? `✓ Connected · ${testResult.latencyMs}ms`
                : `✗ ${testResult.error ?? 'Connection failed'}`}
            </p>
          )}

          {!data?.configured && (
            <p className="text-[11px] text-center text-gray-500">
              Configure UNITE_HUB_API_URL + UNITE_HUB_API_KEY to enable
            </p>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-gray-400 hover:text-white hover:bg-white/[0.06] text-xs h-8"
            onClick={() => window.open('https://unite-hub.unite-group.com.au', '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-2" />
            Open Unite-Group
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}
