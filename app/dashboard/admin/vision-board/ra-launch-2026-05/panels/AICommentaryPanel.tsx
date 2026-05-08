'use client';

/**
 * AI commentary panel — calls /api/internal/vision-board/ai-commentary on
 * demand. The "AI Vision Visual Production with AI intelligence" overlay
 * the user asked for. Each panel can be critiqued individually.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AICommentaryResponse } from '@/lib/vision-board/types';

const PANELS = [
  { id: 'brand', label: 'Brand' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'motion', label: 'Motion' },
  { id: 'copy', label: 'Copy' },
  { id: 'competitive', label: 'Competitive' },
  { id: 'runbook', label: 'Runbook' },
] as const;

type PanelId = (typeof PANELS)[number]['id'];

function riskBadge(risk: AICommentaryResponse['driftRisk']) {
  const variant =
    risk === 'high'
      ? 'bg-destructive/15 text-destructive'
      : risk === 'medium'
        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
  return (
    <span className={'inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium uppercase ' + variant}>
      {risk} drift
    </span>
  );
}

export function AICommentaryPanel() {
  const [results, setResults] = useState<Partial<Record<PanelId, AICommentaryResponse>>>({});
  const [loading, setLoading] = useState<PanelId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function critique(panel: PanelId) {
    setLoading(panel);
    setError(null);
    try {
      const res = await fetch('/api/internal/vision-board/ai-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ panel, payload: {} }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AICommentaryResponse = await res.json();
      setResults(prev => ({ ...prev, [panel]: data }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI commentary</CardTitle>
        <CardDescription>
          Per-panel critique: "what's drift-prone? what's missing? what should we do next?"
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {PANELS.map(p => (
            <Button
              key={p.id}
              variant="outline"
              size="sm"
              onClick={() => critique(p.id)}
              disabled={loading === p.id}
            >
              {loading === p.id ? 'Thinking…' : `Critique ${p.label}`}
            </Button>
          ))}
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {PANELS.map(p => {
            const r = results[p.id];
            if (!r) return null;
            return (
              <article key={p.id} className="rounded-lg border border-border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{p.label}</h3>
                  <div className="flex items-center gap-2">
                    {riskBadge(r.driftRisk)}
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {new Date(r.generatedAt).toLocaleTimeString()}
                    </Badge>
                  </div>
                </div>
                {r.missingPieces.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Missing
                    </p>
                    <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                      {r.missingPieces.map((m, i) => (
                        <li key={i}>• {m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.surprisingObservations.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Surprising
                    </p>
                    <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                      {r.surprisingObservations.map((m, i) => (
                        <li key={i}>• {m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Recommended next step
                  </p>
                  <p className="mt-1 text-sm font-medium">{r.recommendedNextStep}</p>
                </div>
              </article>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
