'use client';

/**
 * Analysis Progress Component
 * Shows progress during pattern analysis
 */

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface AnalysisProgressProps {
  progress: number;
}

export function AnalysisProgress({ progress }: AnalysisProgressProps) {
  return (
    <Card variant="glass">
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Analyzing viral patterns...</span>
            <span className="text-white">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-gray-500">
            Scanning top posts across Twitter, LinkedIn, TikTok, and Instagram
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
