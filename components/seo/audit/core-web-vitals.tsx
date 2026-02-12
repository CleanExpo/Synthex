'use client';

/**
 * Core Web Vitals Component
 * Display for LCP, FID, CLS, and INP metrics
 */

import { TrendingUp } from '@/components/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CoreWebVitals } from './types';

interface CoreWebVitalsCardProps {
  vitals: CoreWebVitals;
}

function getRatingStyles(rating: string): { bg: string; border: string; text: string } {
  switch (rating) {
    case 'good':
      return { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' };
    case 'needs-improvement':
      return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400' };
    default:
      return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' };
  }
}

function formatVitalValue(key: string, value: number): string {
  if (key === 'cls') return value.toFixed(3);
  if (key === 'lcp') return `${value.toFixed(0)}s`;
  return `${value.toFixed(0)}ms`;
}

export function CoreWebVitalsCard({ vitals }: CoreWebVitalsCardProps) {
  return (
    <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-cyan-400" />
          Core Web Vitals
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(vitals).map(([key, vital]) => {
            const styles = getRatingStyles(vital.rating);
            return (
              <div
                key={key}
                className={`p-4 rounded-lg border ${styles.bg} ${styles.border}`}
              >
                <p className="text-gray-400 text-sm uppercase">{key.toUpperCase()}</p>
                <p className={`text-2xl font-bold ${styles.text}`}>
                  {formatVitalValue(key, vital.value)}
                </p>
                <p className="text-xs text-gray-500 capitalize">{vital.rating.replace('-', ' ')}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
