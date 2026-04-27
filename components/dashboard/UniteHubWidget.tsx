'use client';

/**
 * Unite-Group Connection Widget
 *
 * Dashboard card showing the real-time health of the Unite-Group Nexus
 * API connection. Owner-only — returns null for non-owners.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  Building2,
  Copy,
  Zap,
  Loader2,
  ExternalLink,
} from '@/components/icons';
import {
  ConnectionStatusBadge,
  type ConnectionState,
} from '@/components/realtime/ConnectionStatus';
import { cn } from '@/lib/utils';
import { useUser } from '@/hooks/use-user';
import { fetchJson } from '@/lib/fetcher';

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

  if (!user?.isMultiBusinessOwner) return null;

  const connectionState: ConnectionState = !data?.configured
    ? 'disconnected'
    : data.reachable
      ? 'connected'
      : 'reconnecting';

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
      // SYN-732: previously consumed res.json() without checking res.ok, so a
      // 500 response was rendered as success data. Now the non-OK path flows
      // through the catch block and surfaces an honest error state.
      if (!res.ok) {
        throw new Error(`Connection test failed (${res.status})`);
      }
      const json = (await res.json()) as TestResult;
      setTestResult(json);
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

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className={cn(
          'border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm',
          className
        )}
      >
        <div className="px-5 py-4 border-b-[0.5px] border-white/[0.06] flex items-center gap-3">
          <div className="h-8 w-8 border-[0.5px] border-white/[0.06] rounded-sm bg-white/[0.02] animate-pulse" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3 w-32 bg-white/[0.04] rounded-sm animate-pulse" />
            <div className="h-2 w-48 bg-white/[0.03] rounded-sm animate-pulse" />
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="h-9 bg-white/[0.02] border-[0.5px] border-white/[0.04] rounded-sm animate-pulse" />
          <div className="h-16 bg-white/[0.02] border-[0.5px] border-white/[0.04] rounded-sm animate-pulse" />
          <div className="h-9 bg-white/[0.02] border-[0.5px] border-white/[0.04] rounded-sm animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        'border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm',
        className
      )}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b-[0.5px] border-white/[0.06] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 border-[0.5px] border-white/[0.08] bg-white/[0.02] rounded-sm flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-light text-white tracking-tight">
              Unite-Group
            </p>
            <p className="text-[10px] text-white/50 mt-0.5">
              Nexus Dashboard Integration
            </p>
          </div>
        </div>
        <ConnectionStatusBadge state={connectionState} />
      </div>

      <div className="p-5 space-y-5">
        {/* Pull Endpoint */}
        <div className="space-y-2">
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/50">
            Pull Endpoint
            <span className="text-white/70 ml-1 normal-case tracking-normal">
              (configure in Unite-Group)
            </span>
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 font-mono text-[11px] text-orange-300 bg-white/[0.02] border-[0.5px] border-white/[0.06] rounded-sm px-3 py-2 truncate">
              {data?.pullEndpoint ?? '—'}
            </code>
            <button
              onClick={handleCopy}
              aria-label="Copy pull endpoint"
              className="h-8 w-8 flex items-center justify-center border-[0.5px] border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] rounded-sm transition-colors flex-shrink-0"
            >
              <Copy className="h-3.5 w-3.5 text-white/50" />
            </button>
          </div>
        </div>

        {/* Event Types */}
        <div className="space-y-2">
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/50">
            Events sent to Unite-Group
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(data?.eventTypes ?? []).map(type => (
              <span
                key={type}
                className="inline-flex items-center px-2 py-0.5 rounded-sm bg-white/[0.03] border-[0.5px] border-white/[0.08] font-mono text-[9px] text-white/40"
              >
                {type}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={handleTest}
            disabled={isTesting || !data?.configured}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium tracking-wide rounded-sm transition-colors bg-orange-500/[0.08] hover:bg-orange-500/[0.15] text-orange-300 border-[0.5px] border-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isTesting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Testing connection…
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                Test Connection
              </>
            )}
          </button>

          {testResult && (
            <p
              className={cn(
                'text-[11px] text-center font-mono',
                testResult.success ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {testResult.success
                ? `✓ Connected · ${testResult.latencyMs}ms`
                : `✗ ${testResult.error ?? 'Connection failed'}`}
            </p>
          )}

          {!data?.configured && (
            <p className="text-[10px] text-center text-white/50">
              Configure UNITE_HUB_API_URL + UNITE_HUB_API_KEY to enable
            </p>
          )}

          <button
            onClick={() =>
              window.open(
                'https://unite-hub.unite-group.com.au',
                '_blank',
                'noopener,noreferrer'
              )
            }
            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-white/50 hover:text-white/60 border-[0.5px] border-white/[0.06] hover:border-white/[0.12] rounded-sm transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Unite-Group
          </button>
        </div>
      </div>
    </div>
  );
}
