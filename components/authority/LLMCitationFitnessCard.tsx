'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LLMCitationFitnessScore, DesignIssue } from '@/lib/authority/design-audit/types';

interface LLMCitationFitnessCardProps {
  score: LLMCitationFitnessScore;
  issues: DesignIssue[];
}

const CITABLE_LABELS: Record<string, { letter: string; label: string; max: number }> = {
  claimIsolation: { letter: 'C', label: 'Claim Isolation', max: 15 },
  inlineAttribution: { letter: 'I', label: 'Inline Attribution', max: 15 },
  tableListStructure: { letter: 'T', label: 'Table/List Structure', max: 15 },
  answerQueryAlignment: { letter: 'A', label: 'Answer-Query Alignment', max: 15 },
  boldEntityDefinitions: { letter: 'B', label: 'Bold Entity Definitions', max: 10 },
  logicalHeadingDepth: { letter: 'L', label: 'Logical Heading Depth', max: 15 },
  entityConsistency: { letter: 'E', label: 'Entity Consistency', max: 15 },
};

function getDimColor(value: number, max: number): string {
  const pct = value / max;
  if (pct >= 0.8) return 'text-emerald-400 bg-emerald-500/10';
  if (pct >= 0.5) return 'text-amber-400 bg-amber-500/10';
  return 'text-red-400 bg-red-500/10';
}

export function LLMCitationFitnessCard({ score, issues }: LLMCitationFitnessCardProps) {
  const dimensions = Object.entries(CITABLE_LABELS).map(([key, meta]) => ({
    ...meta,
    value: score[key as keyof LLMCitationFitnessScore] as number,
    key,
  }));

  const weakest = [...dimensions]
    .sort((a, b) => a.value / a.max - b.value / b.max)
    .slice(0, 2);

  // Suppress unused issues prop — reserved for future use
  void issues;

  return (
    <Card className="bg-white/5 border-violet-500/10 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-white text-sm font-medium flex items-center justify-between">
          LLM Citation Fitness
          <span className="text-2xl font-bold text-emerald-400">{score.total}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1 mb-4">
          {dimensions.map(d => (
            <div
              key={d.key}
              className={`flex-1 rounded px-1 py-1 text-center text-xs font-bold ${getDimColor(d.value, d.max)}`}
              title={`${d.label}: ${d.value}/${d.max}`}
            >
              {d.letter}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {dimensions.map(dim => (
            <div key={dim.key}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">{dim.label}</span>
                <span className="text-slate-300">{dim.value}/{dim.max}</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    dim.value / dim.max >= 0.8
                      ? 'bg-emerald-500'
                      : dim.value / dim.max >= 0.5
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${(dim.value / dim.max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {weakest.filter(d => d.value / d.max < 0.6).length > 0 && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="text-xs text-slate-500 mb-1">Weakest dimensions:</p>
            {weakest
              .filter(d => d.value / d.max < 0.6)
              .map(d => (
                <p key={d.key} className="text-xs text-amber-400">
                  {d.label} needs improvement
                </p>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
