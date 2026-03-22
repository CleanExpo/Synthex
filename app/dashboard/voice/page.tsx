'use client';

/**
 * /dashboard/voice
 *
 * Brand voice consistency scoring and content tone analysis.
 * Wired to /api/dashboard/voice via SWR.
 */

import useSWR from 'swr';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Mic, FileText, TrendingUp } from 'lucide-react';

interface VoiceDimension {
  name: string;
  score: number;
  targetScore: number;
  description: string;
}

interface RecentContentVoice {
  id: string;
  title: string;
  platform: string;
  publishedAt: string;
  voiceScore: number;
  topTones: string[];
}

interface VoiceData {
  overallConsistency: number;
  trend: number;
  dimensions: VoiceDimension[];
  brandKeywords: Array<{ word: string; frequency: number; sentiment: 'positive' | 'neutral' | 'negative' }>;
  recentContent: RecentContentVoice[];
  recommendations: string[];
}

async function fetcher(url: string): Promise<VoiceData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load voice data (${res.status})`);
  return res.json();
}

const SENTIMENT_COLORS = {
  positive: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  neutral: 'text-white/50 bg-white/5 border-white/10',
  negative: 'text-red-400 bg-red-400/10 border-red-400/20',
};

export default function VoicePage() {
  const { data, error, isLoading } = useSWR<VoiceData>('/api/dashboard/voice', fetcher, {
    refreshInterval: 300_000,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="border-b border-white/[0.06] pb-6">
          <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
          <div className="h-8 w-56 bg-white/[0.05] rounded-sm" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
              <div className="h-4 w-24 bg-white/[0.05] rounded-sm mb-3" />
              <div className="h-2 w-full bg-white/[0.05] rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load voice data. {error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="border-b border-white/[0.06] pb-6">
        <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Branding</p>
        <h1 className="text-2xl font-semibold text-white">Brand Voice</h1>
      </div>

      {/* Overall consistency */}
      <div className="border-[0.5px] border-amber-500/20 bg-amber-500/5 rounded-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-amber-400/70" />
            <p className="text-sm text-amber-300">Voice Consistency Score</p>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className={`h-4 w-4 ${data.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
            <span className={`text-sm ${data.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {data.trend >= 0 ? '+' : ''}{data.trend.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-5xl font-bold text-white">{data.overallConsistency}</p>
          <div className="flex-1">
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${data.overallConsistency}%` }}
              />
            </div>
            <p className="text-xs text-white/30 mt-1">out of 100</p>
          </div>
        </div>
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-4">
        {data.dimensions.map((dim, i) => {
          const pct = (dim.score / 100) * 100;
          const targetPct = (dim.targetScore / 100) * 100;
          return (
            <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-white">{dim.name}</p>
                <span className="text-xs text-white/40">{dim.score}/{dim.targetScore}</span>
              </div>
              <p className="text-xs text-white/30 mb-3">{dim.description}</p>
              <div className="relative h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-amber-500/70 rounded-full"
                  style={{ width: `${pct}%` }}
                />
                <div
                  className="absolute top-0 h-full w-0.5 bg-white/20"
                  style={{ left: `${targetPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Brand keywords */}
      {data.brandKeywords.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-white mb-3">Brand Keywords</h2>
          <div className="flex flex-wrap gap-2">
            {data.brandKeywords.map((kw, i) => (
              <span
                key={i}
                className={`text-xs px-2 py-1 rounded-sm border ${SENTIMENT_COLORS[kw.sentiment]}`}
              >
                {kw.word}
                <span className="ml-1 opacity-60">×{kw.frequency}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent content */}
      {data.recentContent.length > 0 && (
        <div className="border-[0.5px] border-white/[0.06] rounded-sm overflow-hidden">
          <div className="border-b border-white/[0.06] p-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-white/30" />
            <h2 className="text-sm font-medium text-white">Recent Content Analysis</h2>
          </div>
          {data.recentContent.map((content) => (
            <div key={content.id} className="border-b border-white/[0.04] p-4 hover:bg-white/[0.01] transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/80">{content.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-white/30 capitalize">{content.platform}</p>
                    <span className="text-white/10">·</span>
                    <p className="text-xs text-white/30">
                      {new Date(content.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    {content.topTones.slice(0, 2).map((tone, ti) => (
                      <span key={ti} className="text-xs text-amber-400/60 bg-amber-500/10 px-1.5 py-0.5 rounded-sm">
                        {tone}
                      </span>
                    ))}
                  </div>
                </div>
                <div className={`text-sm font-medium ${
                  content.voiceScore >= 80 ? 'text-emerald-400' :
                  content.voiceScore >= 60 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {content.voiceScore}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <h2 className="text-sm font-medium text-white mb-3">How to Improve</h2>
          <ul className="space-y-2">
            {data.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-white/50 flex gap-2">
                <span className="text-amber-500/60 flex-shrink-0 mt-0.5">→</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
