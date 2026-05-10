'use client';

/**
 * NexusConnectionCard
 *
 * Shows Unite-Group Nexus connection status, CCW client sync state,
 * and a link to open the hub. Owner-only — returns null for non-owners.
 *
 * Data: GET /api/nexus/status
 */

import useSWR from 'swr';
import { useUser } from '@/hooks/use-user';
import { cn } from '@/lib/utils';

interface NexusStatusResponse {
  connected: boolean;
  businesses: number;
  last_sync: string;
  ccw_sync: boolean;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        'inline-block w-1.5 h-1.5 rounded-full',
        ok ? 'bg-emerald-400' : 'bg-red-400'
      )}
    />
  );
}

export function NexusConnectionCard({ className }: { className?: string }) {
  const { user } = useUser();

  const { data, isLoading } = useSWR<NexusStatusResponse>(
    '/api/nexus/status',
    fetchJson,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  // Owner-only
  if (!user?.isMultiBusinessOwner) return null;

  const lastSyncLabel = data?.last_sync
    ? new Date(data.last_sync).toLocaleString('en-AU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

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
            <span className="text-sm">🏢</span>
          </div>
          <div>
            <p className="text-sm font-light text-white tracking-tight">
              Unite-Group Nexus
            </p>
            <p className="text-[10px] text-white/50 mt-0.5">
              Portfolio hub connection
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!isLoading && (
            <>
              <StatusDot ok={data?.connected ?? false} />
              <span
                className={cn(
                  'text-[10px] font-mono',
                  data?.connected ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {data?.connected ? 'Connected' : 'Offline'}
              </span>
            </>
          )}
          {isLoading && (
            <span className="text-[10px] text-white/40 font-mono">…</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border-[0.5px] border-white/[0.06] rounded-sm px-3 py-2.5">
            <p className="text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1">
              Businesses
            </p>
            <p className="font-mono text-lg font-medium text-white tabular-nums">
              {isLoading ? '—' : data?.businesses ?? 0}
            </p>
          </div>
          <div className="border-[0.5px] border-white/[0.06] rounded-sm px-3 py-2.5">
            <p className="text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1">
              CCW Sync
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              {!isLoading && <StatusDot ok={data?.ccw_sync ?? false} />}
              <p
                className={cn(
                  'text-xs font-mono',
                  isLoading
                    ? 'text-white/40'
                    : data?.ccw_sync
                      ? 'text-emerald-400'
                      : 'text-red-400'
                )}
              >
                {isLoading ? '—' : data?.ccw_sync ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>
        </div>

        {/* Last sync */}
        <p className="text-[10px] text-white/40">
          Last sync:{' '}
          <span className="font-mono text-white/60">{lastSyncLabel}</span>
        </p>

        {/* Open hub link */}
        <a
          href="https://unite-hub.unite-group.com.au"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-2 text-xs text-white/50 hover:text-white/70 border-[0.5px] border-white/[0.06] hover:border-white/[0.15] rounded-sm transition-colors"
        >
          <span>↗</span>
          Open Hub
        </a>
      </div>
    </div>
  );
}
