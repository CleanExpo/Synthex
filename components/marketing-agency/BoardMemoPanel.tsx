import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import type { BoardMemo } from '@/lib/marketing-agency/types';

interface BoardMemoPanelProps {
  memo: BoardMemo;
}

export function BoardMemoPanel({ memo }: BoardMemoPanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-light leading-none tracking-tight text-white">
            Board Memo
          </h2>
          <Badge variant="outline">{memo.finalBoardDecision}</Badge>
        </div>
        <CardDescription>{memo.campaignObjective}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60">Target Persona</p>
          <p className="mt-1 text-sm text-white/80">{memo.targetPersona}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60">Creative Strategy</p>
          <p className="mt-1 text-sm text-white/80">{memo.creativeStrategy}</p>
        </div>
        <div className="md:col-span-2">
          <p className="text-xs uppercase tracking-wide text-white/60">Evidence Gaps</p>
          <ul className="mt-2 grid gap-2 text-sm text-white/75">
            {memo.evidenceGaps.map((gap) => (
              <li key={gap} className="rounded-sm border border-white/10 px-3 py-2">
                {gap}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
