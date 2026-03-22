'use client';

/**
 * TrendPredictionsWidget — surfaces trending topics with volume and change
 * indicators from the TrendPredictor service.
 *
 * UNI-1611
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Minus } from '@/components/icons';
import { useTrendPredictions } from '@/hooks/useTrendPredictions';

// ── Change Indicator ────────────────────────────────────────────────────────

function ChangeIndicator({ change }: { change: number }) {
  if (change > 5) return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
  if (change < -5) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-white/50" />;
}

// ── Sentiment Badge ─────────────────────────────────────────────────────────

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const styles: Record<string, string> = {
    positive: 'bg-green-500/20 text-green-400 border-green-500/20',
    neutral: 'bg-white/[0.05] text-white/40 border-white/[0.06]',
    negative: 'bg-red-500/20 text-red-400 border-red-500/20',
  };

  return (
    <Badge
      className={`text-[10px] border-[0.5px] ${styles[sentiment] ?? styles.neutral}`}
    >
      {sentiment}
    </Badge>
  );
}

// ── Main Widget ─────────────────────────────────────────────────────────────

export function TrendPredictionsWidget() {
  const { topics, isLoading, error } = useTrendPredictions();

  if (isLoading) {
    return (
      <Card className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
        </CardContent>
      </Card>
    );
  }

  if (error || topics.length === 0) {
    return (
      <Card className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
        <CardHeader>
          <CardTitle className="text-sm font-light text-white flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-400" />
            Trend Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-white/50 text-center py-4">
            {error ||
              'No trend data available yet. Connect a platform to see predictions.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-light text-white flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-orange-400" />
          Trend Predictions
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2">
        {topics.slice(0, 10).map((topic, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-2.5 bg-white/[0.02] border-[0.5px] border-white/[0.06] rounded-sm"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <ChangeIndicator change={topic.change} />
              <span className="text-sm text-white truncate">{topic.topic}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-white/50">
                {topic.change > 0 ? '+' : ''}
                {topic.change}%
              </span>
              <SentimentBadge sentiment={topic.sentiment} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
