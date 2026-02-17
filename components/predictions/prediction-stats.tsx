'use client';

/**
 * Prediction Stats Component
 *
 * @description Displays prediction accuracy statistics in a 3-column grid:
 * - Total predictions made
 * - Verified results count
 * - Average accuracy percentage
 */

import { Card, CardContent } from '@/components/ui/card';
import { Brain, CheckCircle, Target } from '@/components/icons';
import type { PredictionStats as PredictionStatsType } from './types';

interface PredictionStatsProps {
  stats: PredictionStatsType | null;
}

export function PredictionStats({ stats }: PredictionStatsProps) {
  const items = [
    {
      label: 'Total Predictions',
      value: stats?.totalPredictions ?? null,
      icon: Brain,
      format: (v: number) => v.toLocaleString(),
    },
    {
      label: 'Verified Results',
      value: stats?.withResults ?? null,
      icon: CheckCircle,
      format: (v: number) => v.toLocaleString(),
    },
    {
      label: 'Average Accuracy',
      value: stats?.avgAccuracy ?? null,
      icon: Target,
      format: (v: number) => `${v}%`,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {items.map((item) => {
        const Icon = item.icon;
        const displayValue =
          item.value !== null ? item.format(item.value) : '\u2014';

        // Color for accuracy stat
        let valueColor = 'text-white';
        if (item.label === 'Average Accuracy' && item.value !== null) {
          if (item.value >= 70) valueColor = 'text-emerald-400';
          else if (item.value >= 50) valueColor = 'text-yellow-400';
          else valueColor = 'text-red-400';
        }

        return (
          <Card key={item.label} variant="glass">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-400">{item.label}</span>
                <div className="p-2 rounded-lg bg-white/5">
                  <Icon className="h-4 w-4 text-cyan-400" />
                </div>
              </div>
              <p className={`text-2xl font-bold ${valueColor}`}>
                {displayValue}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
