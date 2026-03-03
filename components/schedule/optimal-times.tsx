'use client';

/**
 * Optimal Times Component
 * Shows ML-predicted best posting times per platform,
 * with fallback to industry defaults.
 */

import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { platformIcons, bestTimes } from './schedule-config';
import { PLATFORM_COLORS } from '@/components/calendar';
import { Zap } from '@/components/icons';

interface TimeSlot {
  day: string;
  hour: number;
  score: number;
  confidence: number;
}

interface PlatformPrediction {
  platform: string;
  slots: TimeSlot[];
  topSlot: TimeSlot;
  methodology: 'historical' | 'industry' | 'hybrid';
}

interface ApiResponse {
  success: boolean;
  data: Record<string, PlatformPrediction>;
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}:00 ${period}`;
}

const platforms = 'twitter,linkedin,instagram,facebook,tiktok';

const fetchJson = async (url: string): Promise<ApiResponse | null> => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) return null;
  const json: ApiResponse = await res.json();
  if (!json.success || !json.data) return null;
  return json;
};

export function OptimalTimes() {
  const tz = typeof window !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    : 'UTC';

  const apiUrl = `/api/optimize/auto-schedule?action=multi-platform&platforms=${platforms}&timezone=${encodeURIComponent(tz)}`;

  const { data, isLoading } = useSWR<ApiResponse | null>(
    apiUrl,
    fetchJson,
    { revalidateOnFocus: false }
  );

  const predictions = data?.data ?? null;
  const usingFallback = !isLoading && !predictions;

  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Optimal Posting Times</CardTitle>
            <CardDescription className="text-slate-400">
              {usingFallback
                ? 'Industry-standard engagement patterns'
                : 'Based on your audience engagement patterns'}
            </CardDescription>
          </div>
          {!usingFallback && predictions && (
            <span className="flex items-center gap-1 text-xs bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded-full border border-cyan-500/20">
              <Zap className="h-3 w-3" />
              ML Predicted
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-white/5 rounded mb-2 w-20" />
                <div className="flex gap-1">
                  <div className="h-6 bg-white/5 rounded w-16" />
                  <div className="h-6 bg-white/5 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {(usingFallback ? Object.keys(bestTimes) : Object.keys(predictions || {})).map((platform) => {
              const Icon = platformIcons[platform];
              const color = PLATFORM_COLORS[platform];

              if (usingFallback) {
                const times = bestTimes[platform] || [];
                return (
                  <div key={platform} className="flex items-start space-x-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
                      {Icon && <Icon className="h-4 w-4" style={{ color }} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white capitalize mb-1">{platform}</p>
                      <div className="flex flex-wrap gap-1">
                        {times.map((time: string) => (
                          <span key={time} className="text-xs bg-white/5 text-slate-400 px-2 py-1 rounded">
                            {time}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }

              const pred = predictions![platform];
              if (!pred) return null;
              const topSlots = pred.slots?.slice(0, 4) || [];

              return (
                <div key={platform} className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
                    {Icon && <Icon className="h-4 w-4" style={{ color }} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white capitalize mb-1">{platform}</p>
                    <div className="flex flex-wrap gap-1">
                      {topSlots.map((slot) => (
                        <span
                          key={`${slot.day}-${slot.hour}`}
                          className="text-xs bg-white/5 text-slate-400 px-2 py-1 rounded"
                          title={`${slot.day} — Score: ${slot.score}, Confidence: ${Math.round(slot.confidence * 100)}%`}
                        >
                          {formatHour(slot.hour)}
                          {slot.score >= 80 && (
                            <span className="ml-1 text-green-400">●</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
