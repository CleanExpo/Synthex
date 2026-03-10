'use client';

/**
 * Persuasion Metrics Card
 * Displays persuasion effectiveness metrics
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp } from '@/components/icons';
import { getScoreColor } from './config';
import type { PersuasionMetrics as PersuasionMetricsType } from './types';

interface PersuasionMetricsProps {
  metrics: PersuasionMetricsType;
}

export function PersuasionMetricsCard({ metrics }: PersuasionMetricsProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-cyan-400" />
          Persuasion Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(metrics).map(([key, value]) => (
            <div key={key} className="p-3 bg-white/5 rounded-lg">
              <p className="text-sm text-gray-400 capitalize mb-1">{key}</p>
              <div className="flex items-center gap-2">
                <Progress value={value} className="h-2 flex-1" />
                <span className={`text-sm font-bold ${getScoreColor(value)}`}>
                  {value}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
