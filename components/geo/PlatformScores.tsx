'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Globe } from '@/components/icons';

interface PlatformScore {
  platform: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

interface PlatformScoresProps {
  platformScores: PlatformScore[];
}

const platformLabels: Record<string, { name: string; color: string }> = {
  google_aio: { name: 'Google AI Overviews', color: 'text-blue-400' },
  chatgpt: { name: 'ChatGPT', color: 'text-emerald-400' },
  perplexity: { name: 'Perplexity', color: 'text-purple-400' },
  bing_copilot: { name: 'Bing Copilot', color: 'text-cyan-400' },
};

export function PlatformScores({ platformScores }: PlatformScoresProps) {
  if (!platformScores?.length) return null;

  return (
    <Card className="bg-white/[0.02] border-white/[0.08]">
      <CardHeader>
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <Globe className="h-5 w-5 text-cyan-400" />
          Platform Scores
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {platformScores.map((ps) => {
            const config = platformLabels[ps.platform] || { name: ps.platform, color: 'text-gray-400' };
            return (
              <div key={ps.platform} className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <div className="flex items-center justify-between mb-3">
                  <span className={`font-medium text-sm ${config.color}`}>{config.name}</span>
                  <span className="text-2xl font-bold text-white">{ps.score}</span>
                </div>
                <Progress value={ps.score} className="h-2 mb-3" />
                {ps.strengths.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {ps.strengths.slice(0, 2).map((s, i) => (
                      <p key={i} className="text-xs text-emerald-400">✓ {s}</p>
                    ))}
                  </div>
                )}
                {ps.recommendations.length > 0 && (
                  <div className="space-y-1">
                    {ps.recommendations.slice(0, 2).map((r, i) => (
                      <p key={i} className="text-xs text-amber-400">→ {r}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
