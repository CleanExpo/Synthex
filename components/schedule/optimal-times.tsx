'use client';

/**
 * Optimal Times Component
 * Shows best posting times per platform
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { platformIcons, bestTimes } from './schedule-config';
import { PLATFORM_COLORS } from '@/components/calendar';

export function OptimalTimes() {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="text-lg">Optimal Posting Times</CardTitle>
        <CardDescription className="text-slate-400">
          Based on your audience engagement patterns
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {Object.entries(bestTimes).map(([platform, times]) => {
            const Icon = platformIcons[platform];
            const color = PLATFORM_COLORS[platform];
            return (
              <div key={platform} className="flex items-start space-x-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${color}20` }}
                >
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white capitalize mb-1">{platform}</p>
                  <div className="flex flex-wrap gap-1">
                    {times.map(time => (
                      <span key={time} className="text-xs bg-white/5 text-slate-400 px-2 py-1 rounded">
                        {time}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
