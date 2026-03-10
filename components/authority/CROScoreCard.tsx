'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CROReadinessScore, DesignIssue } from '@/lib/authority/design-audit/types';

interface CROScoreCardProps {
  score: CROReadinessScore;
  issues: DesignIssue[];
}

function getBarColor(value: number, max: number): string {
  const pct = value / max;
  if (pct >= 0.8) return 'bg-emerald-500';
  if (pct >= 0.5) return 'bg-amber-500';
  return 'bg-red-500';
}

export function CROScoreCard({ score, issues }: CROScoreCardProps) {
  const dimensions = [
    { label: 'Conversion Funnel', value: score.conversionFunnel, max: 20 },
    { label: 'Trust Signals', value: score.trustSignals, max: 20 },
    { label: 'Friction Reduction', value: score.frictionReduction, max: 20 },
    { label: 'Mobile Conversion', value: score.mobileConversion, max: 20 },
    { label: 'Above-Fold Conversion', value: score.aboveFoldConversion, max: 20 },
  ];

  const lowestDims = [...dimensions]
    .sort((a, b) => a.value / a.max - b.value / b.max)
    .slice(0, 2);

  // Suppress unused issues prop — reserved for future use
  void issues;

  return (
    <Card className="bg-white/5 border-violet-500/10 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-white text-sm font-medium flex items-center justify-between">
          CRO Readiness
          <span className="text-2xl font-bold text-cyan-400">{score.total}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {dimensions.map(dim => (
          <div key={dim.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">{dim.label}</span>
              <span className="text-slate-300">{dim.value}/{dim.max}</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(dim.value, dim.max)}`}
                style={{ width: `${(dim.value / dim.max) * 100}%` }}
              />
            </div>
          </div>
        ))}

        {lowestDims.filter(d => d.value / d.max < 0.6).length > 0 && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="text-xs text-slate-500 mb-1.5">Priority improvements:</p>
            {lowestDims
              .filter(d => d.value / d.max < 0.6)
              .map(d => (
                <p key={d.label} className="text-xs text-amber-400">
                  Improve {d.label.toLowerCase()}
                </p>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
