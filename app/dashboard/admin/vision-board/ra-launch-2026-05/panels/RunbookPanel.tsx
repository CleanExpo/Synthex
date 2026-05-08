'use client';

/**
 * Runbook panel — T+0 → T+30 calendar.
 *
 * Wave 0 ships an empty 31-day grid with phase shading. Wave 4 fills cells from
 * the runbook.json artefact (per-day drops with time/channel/asset/owner).
 */

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RunbookPanelProps {
  runbook: unknown | null;        // shape lands when Wave 4 ships
  tZeroIso: string;                // ISO date for T+0
}

type Phase = 'launch-day' | 'amplify' | 'distribute' | 'measure';

interface RunbookDrop {
  time: string;
  channel: string;
  asset: string;
  owner?: string;
  voiceTag?: string;
  fallback?: string;
}

interface RunbookDay {
  tPlus: number;
  date: string;
  weekday?: string;
  phase: Phase;
  drops: RunbookDrop[];
  gateCheck?: string;
  contingency?: string | null;
}

interface RunbookShape {
  tZeroIso: string;
  windowDays: number;
  calendar: RunbookDay[];
}

function phaseFor(dayOffset: number): Phase {
  if (dayOffset === 0) return 'launch-day';
  if (dayOffset <= 7) return 'amplify';
  if (dayOffset <= 14) return 'distribute';
  return 'measure';
}

function phaseColour(p: Phase): string {
  if (p === 'launch-day') return 'bg-slate-500/10 border-slate-500/30';
  if (p === 'amplify') return 'bg-emerald-500/10 border-emerald-500/30';
  if (p === 'distribute') return 'bg-amber-500/10 border-amber-500/30';
  return 'bg-sky-500/10 border-sky-500/30';
}

function isRunbookShape(x: unknown): x is RunbookShape {
  return (
    typeof x === 'object' &&
    x !== null &&
    Array.isArray((x as RunbookShape).calendar)
  );
}

export function RunbookPanel({ runbook, tZeroIso }: RunbookPanelProps) {
  const days: RunbookDay[] = useMemo(() => {
    // If the runbook.json is hydrated, use its calendar directly.
    if (isRunbookShape(runbook)) return runbook.calendar;
    // Otherwise build an empty 31-day skeleton seeded with phase only.
    const tZero = new Date(tZeroIso);
    return Array.from({ length: 31 }, (_, i) => {
      const date = new Date(tZero);
      date.setDate(tZero.getDate() + i);
      return {
        tPlus: i,
        date: date.toISOString().slice(0, 10),
        phase: phaseFor(i),
        drops: [],
      };
    });
  }, [runbook, tZeroIso]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Runbook · T+0 → T+30</CardTitle>
            <CardDescription>
              Standard tier · LinkedIn + email + web · industry pitches T+3 / T+5
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            {runbook ? 'Wave 4 hydrated' : 'Wave 4 pending'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4 text-[10px] flex-wrap">
          <span className="rounded-md border border-slate-500/30 bg-slate-500/10 px-2 py-0.5">
            T+0 · Launch day
          </span>
          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5">
            T+1–T+7 · Amplify
          </span>
          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5">
            T+8–T+14 · Distribute
          </span>
          <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5">
            T+15–T+30 · Measure
          </span>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map(d => (
            <div
              key={d.date}
              className={'flex flex-col gap-1 rounded-md border p-2 ' + phaseColour(d.phase)}
              title={d.gateCheck ?? undefined}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[10px] font-semibold">T+{d.tPlus}</span>
                <span className="font-mono text-[9px] text-muted-foreground">
                  {d.weekday ?? ''} {d.date.slice(5)}
                </span>
              </div>
              {d.drops.length === 0 ? (
                <p className="text-[10px] italic text-muted-foreground">rest</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {d.drops.map((drop, j) => (
                    <li key={j} className="truncate text-[10px] font-medium" title={drop.asset}>
                      <span className="text-muted-foreground">{drop.time}</span>
                      <br />
                      {drop.channel.replace(/^linkedin-/, 'li-').replace(/^industry-publication-/, 'pub-')}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
