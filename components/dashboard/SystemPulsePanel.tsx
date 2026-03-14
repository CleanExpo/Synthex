'use client';

/**
 * System Pulse Panel
 *
 * Aggregated live health view of all external services used by Synthex.
 * Auto-refreshes every 30 seconds. Manual refresh available.
 *
 * Services monitored:
 *  - Database (PostgreSQL via Prisma)
 *  - Cache (Redis)
 *  - Stripe (billing)
 *  - AI Engine (OpenRouter)
 *  - Email (Resend / SendGrid)
 *  - Unite-Group (Nexus dashboard integration)
 *
 * Data: single SWR key using Promise.allSettled across all health endpoints.
 * Each service pill is clickable to expand detail.
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  { key: 'db',       label: 'Database',    url: '/api/health/db',        icon: Database   },
  { key: 'redis',    label: 'Cache',       url: '/api/health/redis',     icon: Server     },
  { key: 'stripe',   label: 'Stripe',      url: '/api/health/stripe',    icon: CreditCard },
  { key: 'ai',       label: 'AI Engine',   url: '/api/health/ai',        icon: Zap        },
  { key: 'email',    label: 'Email',       url: '/api/health/email',     icon: Mail       },
  { key: 'unitehub', label: 'Unite-Group', url: '/api/unite-hub/status', icon: Building2  },
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

function deriveStatus(key: ServiceKey, data: Record<string, unknown> | null): ServiceStatus {
  if (!data || data.error) return 'unknown';

  // Unite-Hub uses configured/reachable shape
  if (key === 'unitehub') {
    if (!data.configured) return 'unknown';
    return data.reachable ? 'ok' : 'warn';
  }

  // Standard health endpoints return { status: 'healthy' | 'degraded' | 'unhealthy' | 'error' }
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

// ── Status dot ────────────────────────────────────────────────────────────────

const STATUS_DOT: Record<ServiceStatus, string> = {
  ok:      'bg-emerald-400',
  warn:    'bg-amber-400',
  error:   'bg-red-400',
  unknown: 'bg-gray-500',
};

const STATUS_TEXT: Record<ServiceStatus, string> = {
  ok:      'text-emerald-400',
  warn:    'text-amber-400',
  error:   'text-red-400',
  unknown: 'text-gray-500',
};

// ── SWR fetcher ───────────────────────────────────────────────────────────────

const fetchAllHealth = async (): Promise<ServiceResult[]> => {
  const results = await Promise.allSettled(
    SERVICES.map((s) =>
      fetch(s.url, { credentials: 'include' })
        .then((r) => r.json() as Promise<Record<string, unknown>>)
    )
  );

  return SERVICES.map((svc, i) => {
    const raw = results[i].status === 'fulfilled'
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

  // Update "last refreshed" timestamp each time data resolves
  useEffect(() => {
    if (data) setLastRefreshed(new Date());
  }, [data]);

  const toggleExpand = useCallback((key: ServiceKey) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  }, []);

  const handleRefresh = useCallback(() => {
    void mutate();
  }, [mutate]);

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading && !data) {
    return (
      <Card variant="glass" className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-gray-400" />
              <CardTitle className="text-sm">System Pulse</CardTitle>
            </div>
            <div className="h-3 w-24 rounded bg-white/[0.06] animate-pulse" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SERVICES.map((s) => (
              <div
                key={s.key}
                className="h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const services = data ?? [];
  const expandedService = services.find((s) => s.key === expandedKey);

  return (
    <Card variant="glass" className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-gray-400 shrink-0" />
            <CardTitle className="text-sm">System Pulse</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            {lastRefreshed && (
              <span className="text-[11px] text-gray-500 hidden sm:block">
                Updated {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-500 hover:text-white hover:bg-white/[0.06]"
              onClick={handleRefresh}
              aria-label="Refresh system health"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">

        {/* Service pills grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {services.map((svc) => {
            const Icon = svc.icon;
            const isExpanded = expandedKey === svc.key;

            return (
              <button
                key={svc.key}
                onClick={() => toggleExpand(svc.key)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-left w-full transition-colors',
                  'bg-white/[0.04] border border-white/[0.08]',
                  'hover:bg-white/[0.07] hover:border-white/[0.14]',
                  isExpanded && 'border-white/[0.18] bg-white/[0.07]'
                )}
              >
                <Icon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span className="text-xs text-white/70 flex-1 truncate">{svc.label}</span>
                <span
                  className={cn(
                    'h-2 w-2 rounded-full shrink-0',
                    STATUS_DOT[svc.status]
                  )}
                />
                {svc.latencyMs !== null && (
                  <span className="text-[10px] text-gray-500 hidden sm:block">
                    {svc.latencyMs}ms
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Expanded service detail */}
        {expandedService && (
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.08] p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className={cn('text-xs font-medium', STATUS_TEXT[expandedService.status])}>
                {expandedService.label} — {expandedService.status.toUpperCase()}
              </p>
              {expandedService.latencyMs !== null && (
                <span className="text-[11px] text-gray-500">
                  {expandedService.latencyMs}ms
                </span>
              )}
            </div>
            {expandedService.detail && (
              <pre className="text-[10px] text-gray-500 overflow-auto max-h-28 leading-relaxed">
                {JSON.stringify(
                  // Strip sensitive fields before display
                  Object.fromEntries(
                    Object.entries(expandedService.detail).filter(
                      ([k]) => !['apiKey', 'key', 'secret', 'password', 'token'].includes(k)
                    )
                  ),
                  null,
                  2
                )}
              </pre>
            )}
          </div>
        )}

        {/* Overall summary */}
        {services.length > 0 && (
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3 text-[11px] text-gray-500">
              <span>
                <span className="text-emerald-400 font-medium">
                  {services.filter((s) => s.status === 'ok').length}
                </span>{' '}
                healthy
              </span>
              {services.some((s) => s.status === 'warn') && (
                <span>
                  <span className="text-amber-400 font-medium">
                    {services.filter((s) => s.status === 'warn').length}
                  </span>{' '}
                  degraded
                </span>
              )}
              {services.some((s) => s.status === 'error') && (
                <span>
                  <span className="text-red-400 font-medium">
                    {services.filter((s) => s.status === 'error').length}
                  </span>{' '}
                  down
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-600">auto-refreshes every 30s</span>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
