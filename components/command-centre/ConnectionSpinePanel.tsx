'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from '@/components/icons';
import { fetchWithCSRF } from '@/lib/csrf';
import { cn } from '@/lib/utils';
import type {
  ConnectionSpineHealth,
  SpineStatus,
} from '@/lib/connection-spine/health';

const STATUS_CLASSES: Record<SpineStatus, string> = {
  ready: 'border-emerald-500/25 bg-emerald-500/[0.04] text-emerald-300',
  stale: 'border-amber-500/25 bg-amber-500/[0.04] text-amber-300',
  action_required: 'border-cyan-500/25 bg-cyan-500/[0.04] text-cyan-300',
  blocked: 'border-red-500/25 bg-red-500/[0.04] text-red-300',
};

/**
 * Connection-health spine panel (SYN-1030). Self-fetches the unified health for
 * Linear / Obsidian / Hermes / social and surfaces it as operator
 * blockers/actions — not raw diagnostics.
 */
export function ConnectionSpinePanel() {
  const [health, setHealth] = useState<ConnectionSpineHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchWithCSRF('/api/command-centre/connection-spine');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ConnectionSpineHealth;
        if (active) setHealth(data);
      } catch {
        if (active) setError("Couldn't load connection health.");
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="border-[0.5px] border-white/[0.06] rounded-sm p-4 bg-black/10">
      <div className="flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-white/40" />
        <div className="text-xs uppercase tracking-widest text-white/35">
          Connection spine
        </div>
      </div>

      {error ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-red-300/80">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      ) : isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-white/40">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Checking systems…
        </div>
      ) : !health || health.systems.length === 0 ? (
        <div className="mt-4 text-xs text-white/40">No systems to report.</div>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2 text-xs">
            {health.blockerCount === 0 ? (
              <span className="inline-flex items-center gap-1 text-emerald-300/90">
                <CheckCircle2 className="h-3.5 w-3.5" /> All systems ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-300/90">
                <AlertTriangle className="h-3.5 w-3.5" />
                {health.blockerCount} need
                {health.blockerCount === 1 ? 's' : ''} action
              </span>
            )}
          </div>

          <ul className="mt-3 space-y-2">
            {health.systems.map(s => (
              <li
                key={s.system}
                className="flex items-start justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="text-white/75">{s.label}</div>
                  <div className="text-white/40 leading-snug">{s.detail}</div>
                  {s.action ? (
                    <div className="text-cyan-300/70 mt-0.5">→ {s.action}</div>
                  ) : null}
                </div>
                <span
                  className={cn(
                    'shrink-0 border-[0.5px] px-2 py-1 rounded-sm text-xs uppercase tracking-wider',
                    STATUS_CLASSES[s.status]
                  )}
                >
                  {s.status.replace(/_/g, ' ')}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
