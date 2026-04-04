'use client';

/**
 * System Pulse Panel
 *
 * Aggregated live health view of all external services used by Synthex.
 * Auto-refreshes every 30 seconds. Manual refresh available.
 */

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import {
  Database,
  Server,
  CreditCard,
  Zap,
  Mail,
  Building2,
  RefreshCw,
} from '@/components/icons';
import { cn } from '@/lib/utils';

// ── Service definitions ───────────────────────────────────────────────────────

type ServiceKey = 'db' | 'redis' | 'stripe' | 'ai' | 'email' | 'unitehub';

interface ServiceDef {
  key: ServiceKey;
  label: string;
  url: string;
  icon: React.ElementType;
}

const SERVICES: ServiceDef[] = [
  { key: 'db', label: 'Database', url: '/api/health/db', icon: Database },
  { key: 'redis', label: 'Cache', url: '/api/health/redis', icon: Server },
  {
    key: 'stripe',
    label: 'Stripe',
    url: '/api/health/stripe',
    icon: CreditCard,
  },
  { key: 'ai', label: 'AI Engine', url: '/api/health/ai', icon: Zap },
  { key: 'email', label: 'Email', url: '/api/health/email', icon: Mail },
  {
    key: 'unitehub',
    label: 'Unite-Group',
    url: '/api/unite-hub/status',
    icon: Building2,
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type ServiceStatus = 'ok' | 'warn' | 'error' | 'unknown';

interface ServiceResult {
  key: ServiceKey;
  label: string;
  icon: React.ElementType;
  status: ServiceStatus;
  latencyMs: number | null;
  detail: Record<string, unknown> | null;
}

// ── Status derivation ─────────────────────────────────────────────────────────

function deriveStatus(
  key: ServiceKey,
  data: Record<string, unknown> | null
): ServiceStatus {
  if (!data || data.error) return 'unknown';
  if (key === 'unitehub') {
    if (!data.configured) return 'unknown';
    return data.reachable ? 'ok' : 'warn';
  }
  const s = data.status as string | undefined;
  if (!s) return 'unknown';
  if (s === 'healthy') return 'ok';
  if (s === 'degraded') return 'warn';
  return 'error';
}

function extractLatency(data: Record<string, unknown> | null): number | null {
  if (!data) return null;
  const v = data.latencyMs ?? data.responseTimeMs ?? data.apiResponseTimeMs;
  return typeof v === 'number' ? v : null;
}

// ── Status colours ────────────────────────────────────────────────────────────

const STATUS_DOT: Record<ServiceStatus, string> = {
  ok: 'bg-emerald-400',
  warn: 'bg-orange-400',
  error: 'bg-red-400',
  unknown: 'bg-white/20',
};

const STATUS_TEXT: Record<ServiceStatus, string> = {
  ok: 'text-emerald-400',
  warn: 'text-orange-400',
  error: 'text-red-400',
  unknown: 'text-white/50',
};

// ── SWR fetcher ───────────────────────────────────────────────────────────────

const fetchAllHealth = async (): Promise<ServiceResult[]> => {
  const results = await Promise.allSettled(
    SERVICES.map(s =>
      fetch(s.url, { credentials: 'include' }).then(
        r => r.json() as Promise<Record<string, unknown>>
      )
    )
  );

  return SERVICES.map((svc, i) => {
    const raw =
      results[i].status === 'fulfilled'
        ? (results[i] as PromiseFulfilledResult<Record<string, unknown>>).value
        : null;
    return {
      key: svc.key,
      label: svc.label,
      icon: svc.icon,
      status: deriveStatus(svc.key, raw),
      latencyMs: extractLatency(raw),
      detail: raw,
    };
  });
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SystemPulsePanel({ className }: { className?: string }) {
  const [expandedKey, setExpandedKey] = useState<ServiceKey | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const { data, isLoading, mutate } = useSWR<ServiceResult[]>(
    'synthex:system-health',
    fetchAllHealth,
    { revalidateOnFocus: false, refreshInterval: 30_000 }
  );

  useEffect(() => {
    if (data) setLastRefreshed(new Date());
  }, [data]);

  const toggleExpand = useCallback((key: ServiceKey) => {
    setExpandedKey(prev => (prev === key ? null : key));
  }, []);

  const handleRefresh = useCallback(() => {
    void mutate();
  }, [mutate]);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading && !data) {
    return (
      <div
        className={cn(
          'border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm',
          className
        )}
      >
        <div className="px-5 py-4 border-b-[0.5px] border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-3.5 w-3.5 text-white/50" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/50">
              System Pulse
            </span>
          </div>
          <div className="h-2 w-20 bg-white/[0.04] rounded-sm animate-pulse" />
        </div>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SERVICES.map(s => (
            <div
              key={s.key}
              className="h-10 rounded-sm bg-white/[0.02] border-[0.5px] border-white/[0.04] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const services = data ?? [];
  const expandedService = services.find(s => s.key === expandedKey);

  return (
    <div
      className={cn(
        'border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm',
        className
      )}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b-[0.5px] border-white/[0.06] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Server className="h-3.5 w-3.5 text-white/50 shrink-0" />
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
            System Pulse
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-[10px] font-mono text-white/50 hidden sm:block">
              {lastRefreshed.toLocaleTimeString('en-AU', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
          <button
            onClick={handleRefresh}
            aria-label="Refresh system health"
            className="h-6 w-6 flex items-center justify-center rounded-sm border-[0.5px] border-white/[0.06] text-white/50 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
          >
            <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Service pills */}
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {services.map(svc => {
            const Icon = svc.icon;
            const isExpanded = expandedKey === svc.key;

            return (
              <button
                key={svc.key}
                onClick={() => toggleExpand(svc.key)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-sm text-left w-full transition-colors',
                  'border-[0.5px] border-white/[0.06] bg-white/[0.01]',
                  'hover:bg-white/[0.04] hover:border-white/[0.1]',
                  isExpanded && 'border-white/[0.12] bg-white/[0.04]'
                )}
              >
                <Icon className="h-3 w-3 text-white/50 shrink-0" />
                <span className="text-[10px] text-white/50 flex-1 truncate">
                  {svc.label}
                </span>
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full shrink-0',
                    STATUS_DOT[svc.status]
                  )}
                />
                {svc.latencyMs !== null && (
                  <span className="font-mono text-[9px] text-white/50 hidden sm:block tabular-nums">
                    {svc.latencyMs}ms
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Expanded detail */}
        {expandedService && (
          <div className="border-[0.5px] border-white/[0.06] rounded-sm p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <p
                className={cn(
                  'text-[10px] uppercase tracking-[0.15em]',
                  STATUS_TEXT[expandedService.status]
                )}
              >
                {expandedService.label} — {expandedService.status.toUpperCase()}
              </p>
              {expandedService.latencyMs !== null && (
                <span className="font-mono text-[10px] text-white/50 tabular-nums">
                  {expandedService.latencyMs}ms
                </span>
              )}
            </div>
            {expandedService.detail && (
              <pre className="text-[10px] text-white/50 overflow-auto max-h-28 leading-relaxed font-mono">
                {JSON.stringify(
                  Object.fromEntries(
                    Object.entries(expandedService.detail).filter(
                      ([k]) =>
                        ![
                          'apiKey',
                          'key',
                          'secret',
                          'password',
                          'token',
                        ].includes(k)
                    )
                  ),
                  null,
                  2
                )}
              </pre>
            )}
          </div>
        )}

        {/* Summary footer */}
        {services.length > 0 && (
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-4 text-[10px]">
              <span>
                <span className="text-emerald-400 font-mono font-medium tabular-nums">
                  {services.filter(s => s.status === 'ok').length}
                </span>
                <span className="text-white/50 ml-1">healthy</span>
              </span>
              {services.some(s => s.status === 'warn') && (
                <span>
                  <span className="text-orange-400 font-mono font-medium tabular-nums">
                    {services.filter(s => s.status === 'warn').length}
                  </span>
                  <span className="text-white/50 ml-1">degraded</span>
                </span>
              )}
              {services.some(s => s.status === 'error') && (
                <span>
                  <span className="text-red-400 font-mono font-medium tabular-nums">
                    {services.filter(s => s.status === 'error').length}
                  </span>
                  <span className="text-white/50 ml-1">down</span>
                </span>
              )}
            </div>
            <span className="text-[9px] text-white/70">
              auto-refreshes every 30s
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
