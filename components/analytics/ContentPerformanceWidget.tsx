'use client';

/**
 * ContentPerformanceWidget — surfaces historical content performance patterns
 * and AI-driven insights from the ContentPerformanceAnalyzer service.
 *
 * UNI-1611
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Clock,
  Hash,
  Sparkles,
  BarChart,
} from '@/components/icons';
import { useContentPerformance } from '@/hooks/useContentPerformance';

// ── Impact Badge ────────────────────────────────────────────────────────────

function ImpactBadge({ impact }: { impact: 'high' | 'medium' | 'low' }) {
  const styles = {
    high: 'bg-green-500/20 text-green-400 border-green-500/20',
    medium: 'bg-orange-500/20 text-orange-400 border-orange-500/20',
    low: 'bg-white/[0.05] text-white/40 border-white/[0.06]',
  };

  return (
    <Badge className={`text-[10px] border-[0.5px] ${styles[impact]}`}>
      {impact}
    </Badge>
  );
}

// ── Main Widget ─────────────────────────────────────────────────────────────

export function ContentPerformanceWidget() {
  const { data, isLoading, error } = useContentPerformance();
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <Card className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
        <CardHeader>
          <CardTitle className="text-sm font-light text-white flex items-center gap-2">
            <BarChart className="h-4 w-4 text-orange-400" />
            Content Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-white/50 text-center py-4">
            {error ||
              'No performance data yet. Start posting to see patterns emerge.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { summary, patterns, insights } = data;

  return (
    <Card className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-light text-white flex items-center gap-2">
          <BarChart className="h-4 w-4 text-orange-400" />
          Content Performance Patterns
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Summary row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-white/40">Total Posts</span>
            <div className="text-xl font-bold text-white">
              {summary.totalPosts}
            </div>
          </div>
          <div>
            <span className="text-xs text-white/40">Avg Engagement</span>
            <div className="text-xl font-bold text-white">
              {summary.avgEngagement.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Best posting times */}
        {patterns.bestDays.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Clock className="h-3 w-3" />
              Best Posting Times
            </div>
            <div className="flex flex-wrap gap-1.5">
              {patterns.bestDays.slice(0, 3).map(d => (
                <Badge
                  key={d.day}
                  className="bg-orange-500/10 text-orange-300 border-[0.5px] border-orange-500/20 text-xs"
                >
                  {d.day}
                </Badge>
              ))}
              {patterns.bestHours.slice(0, 3).map(h => (
                <Badge
                  key={h.hour}
                  className="bg-cyan-500/10 text-cyan-300 border-[0.5px] border-cyan-500/20 text-xs"
                >
                  {h.hour}:00
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Top hashtags */}
        {patterns.topHashtags.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Hash className="h-3 w-3" />
              Top Hashtags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {patterns.topHashtags.slice(0, 8).map(t => (
                <Badge
                  key={t.tag}
                  className="bg-white/[0.05] text-white/60 border-[0.5px] border-white/[0.06] text-xs"
                >
                  #{t.tag}
                  <span className="ml-1 text-white/50">({t.count})</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* AI Insights */}
        {insights.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Sparkles className="h-3 w-3" />
              AI Insights
            </div>
            <div className="space-y-2">
              {insights.slice(0, expanded ? undefined : 3).map((insight, i) => (
                <div
                  key={i}
                  className="p-3 bg-white/[0.02] border-[0.5px] border-white/[0.06] rounded-sm space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white">
                      {insight.title}
                    </span>
                    <ImpactBadge impact={insight.impact} />
                  </div>
                  <p className="text-xs text-white/40">{insight.description}</p>
                  <p className="text-xs text-orange-400/80">
                    {insight.recommendation}
                  </p>
                </div>
              ))}
            </div>
            {insights.length > 3 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpanded(!expanded)}
                className="w-full h-7 text-xs text-white/50 hover:text-white/50"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Show {insights.length - 3} More
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
