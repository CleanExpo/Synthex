'use client';

/**
 * Copy panel — placeholder until Wave 1 (positioning) and Wave 3 (emails +
 * LinkedIn) land. Renders three subsections with empty states; each will
 * hydrate from the symlinked Pi-CEO research dir as artefacts arrive.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CopyPanelProps {
  positioningMd: string | null;
  positioningUpdatedAt: string | null;
  positioningSource: 'vault' | 'pi-ceo' | 'unknown' | null;
  icpMd: string | null;
}

function PendingState({ wave, what }: { wave: 1 | 3; what: string }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-6">
      <Badge variant="outline" className="font-mono text-[10px]">
        Wave {wave} pending
      </Badge>
      <p className="text-sm text-muted-foreground">{what}</p>
    </div>
  );
}

export function CopyPanel({
  positioningMd,
  positioningUpdatedAt,
  positioningSource,
  icpMd,
}: CopyPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Copy</CardTitle>
        <CardDescription>
          Positioning · ICP (Wave 1) — Insurer landing · Email sequence · LinkedIn drumbeat (Wave 3)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Positioning · SYN-916</h3>
            <div className="flex items-center gap-2">
              {positioningSource && (
                <Badge variant="outline" className="font-mono text-[10px] capitalize">
                  source: {positioningSource}
                </Badge>
              )}
              {positioningUpdatedAt && (
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {positioningUpdatedAt}
                </Badge>
              )}
            </div>
          </div>
          {positioningMd ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-4 text-xs">
              {positioningMd}
            </pre>
          ) : (
            <PendingState
              wave={1}
              what="Pi-CEO writes positioning/ra-2026-05.md to its marketing-studio/.research/. Approve the spawn-task to kick off the senior strategist agents."
            />
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">ICP · SYN-916</h3>
          {icpMd ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-4 text-xs">
              {icpMd}
            </pre>
          ) : (
            <PendingState
              wave={1}
              what="3 segments × triggers/vocab/watering-holes. Same blocker — Pi-CEO Wave 1 needs spawn approval."
            />
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Insurer landing page · SYN-918</h3>
          <PendingState
            wave={3}
            what="Will render at /restoreassist/insurers and embed the NIR explainer video as hero. Synthex page, RA tokens (no Synthex token leak)."
          />
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Email sequence · SYN-919</h3>
          <PendingState
            wave={3}
            what="5 touches: D0 welcome → D2 quick-start → D5 NIR demo → D10 case study → D20 referral ask. Grade ≤6, brand voice."
          />
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">LinkedIn drumbeat · SYN-920</h3>
          <PendingState
            wave={3}
            what="12 pieces: 1 founder origin · 1 NIR explainer · 3 product scenes · 1 carousel comparison · 6 customer-quote placeholders."
          />
        </section>
      </CardContent>
    </Card>
  );
}
