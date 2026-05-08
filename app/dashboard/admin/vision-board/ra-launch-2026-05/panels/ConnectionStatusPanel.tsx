'use client';

/**
 * Connection Status panel — observability for the Synthex ↔ Brain-2 ↔ Pi-CEO ↔
 * Linear ↔ Supabase wiring.
 *
 * Shows live / degraded / missing per integration with copy-to-clipboard fix
 * hints for missing items.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ConnectionCheck, ConnectionLevel } from '@/lib/quick-access/connection-status';

interface ConnectionStatusPanelProps {
  checks: ConnectionCheck[];
}

const LEVEL_THEME: Record<ConnectionLevel, { dot: string; label: string; chip: string }> = {
  live: {
    dot: 'bg-emerald-500',
    label: 'live',
    chip: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400',
  },
  degraded: {
    dot: 'bg-amber-500',
    label: 'degraded',
    chip: 'border-amber-500/40 text-amber-700 dark:text-amber-400',
  },
  missing: {
    dot: 'bg-destructive',
    label: 'missing',
    chip: 'border-destructive/40 text-destructive',
  },
};

function CheckRow({ check }: { check: ConnectionCheck }) {
  const theme = LEVEL_THEME[check.level];
  const [copied, setCopied] = useState(false);

  const copyHint = async () => {
    if (!check.fixHint) return;
    try {
      await navigator.clipboard.writeText(check.fixHint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span
            className={'mt-1.5 h-2 w-2 shrink-0 rounded-full ' + theme.dot}
            aria-label={theme.label}
          />
          <div>
            <h3 className="text-sm font-semibold">{check.label}</h3>
            <p className="text-xs text-muted-foreground">{check.description}</p>
          </div>
        </div>
        <Badge variant="outline" className={'shrink-0 capitalize ' + theme.chip}>
          {theme.label}
        </Badge>
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">{check.detail}</p>
      {check.fixHint && (
        <button
          type="button"
          onClick={copyHint}
          className="mt-1 self-start rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium hover:bg-muted"
        >
          {copied ? '✓ command copied' : '↗ copy fix command'}
        </button>
      )}
    </div>
  );
}

export function ConnectionStatusPanel({ checks }: ConnectionStatusPanelProps) {
  const live = checks.filter(c => c.level === 'live').length;
  const degraded = checks.filter(c => c.level === 'degraded').length;
  const missing = checks.filter(c => c.level === 'missing').length;
  const overall: ConnectionLevel =
    missing > 0 ? 'missing' : degraded > 0 ? 'degraded' : 'live';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Connection status</CardTitle>
            <CardDescription>
              Synthex ↔ Brain-2 ↔ Pi-CEO ↔ Linear ↔ Supabase wiring · checked at request time
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className={'h-3 w-3 rounded-full ' + LEVEL_THEME[overall].dot} />
            <Badge variant="outline" className={'font-mono text-[10px] ' + LEVEL_THEME[overall].chip}>
              {live}/{checks.length} live
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px]">
          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">
            ● {live} live
          </span>
          {degraded > 0 && (
            <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-400">
              ● {degraded} degraded
            </span>
          )}
          {missing > 0 && (
            <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-destructive">
              ● {missing} missing
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {checks.map(c => (
            <CheckRow key={c.id} check={c} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
