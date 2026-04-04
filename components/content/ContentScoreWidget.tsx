'use client';

/**
 * ContentScoreWidget — real-time quality score gauge + dimension bars + suggestions.
 *
 * Uses the pure-function ContentScorer via /api/content/score (zero AI calls = instant).
 * Circular gauge reuses the SVG pattern from CompositeHealthWidget.
 *
 * UNI-1611
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from '@/components/icons';
import { useContentScore } from '@/hooks/useContentScore';

interface ContentScoreWidgetProps {
  content: string;
  platform: string;
}

// ── Circular Gauge ──────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const colour = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-24 h-24">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={colour}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">
          {Math.round(score)}
        </span>
        <span className="text-[10px] text-gray-300">/100</span>
      </div>
    </div>
  );
}

// ── Dimension Bar ───────────────────────────────────────────────────────────

function DimensionBar({ label, score }: { label: string; score: number }) {
  const colour =
    score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/60 capitalize">{label}</span>
        <span className="text-white/40">{score}</span>
      </div>
      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colour}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ── Main Widget ─────────────────────────────────────────────────────────────

export function ContentScoreWidget({
  content,
  platform,
}: ContentScoreWidgetProps) {
  // Existing hook auto-scores with debounce when content/platform changes
  const { score, isLoading, refresh } = useContentScore({
    content,
    platform,
    enabled: !!content,
  });

  if (!content) return null;

  return (
    <Card className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-light text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-orange-400" />
            Content Quality Score
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={refresh}
            disabled={isLoading}
            className="h-7 text-xs text-white/40 hover:text-white/60"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              'Re-score'
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && !score ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
          </div>
        ) : score ? (
          <>
            {/* Score + dimensions row */}
            <div className="flex gap-6">
              <ScoreGauge score={score.overall} />
              <div className="flex-1 space-y-2">
                <DimensionBar
                  label="readability"
                  score={score.dimensions.readability.score}
                />
                <DimensionBar
                  label="engagement"
                  score={score.dimensions.engagement.score}
                />
                <DimensionBar
                  label="platform fit"
                  score={score.dimensions.platformFit.score}
                />
                <DimensionBar
                  label="clarity"
                  score={score.dimensions.clarity.score}
                />
                <DimensionBar
                  label="emotional"
                  score={score.dimensions.emotional.score}
                />
                <DimensionBar
                  label="writing quality"
                  score={score.dimensions.writingQuality.score}
                />
              </div>
            </div>

            {/* Top suggestions */}
            {score.topSuggestions.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs text-white/40 font-medium">
                  Suggestions
                </span>
                <ul className="space-y-1">
                  {score.topSuggestions.map((suggestion, i) => (
                    <li key={i} className="text-xs text-white/50 flex gap-2">
                      <span className="text-orange-400 shrink-0">•</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-white/50 text-center py-4">
            Score will appear after content is generated
          </p>
        )}
      </CardContent>
    </Card>
  );
}
