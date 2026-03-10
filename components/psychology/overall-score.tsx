'use client';

/**
 * Overall Score Card
 * Displays the overall psychology analysis score
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart3 } from '@/components/icons';
import { getScoreColor, getScoreBg } from './config';

interface OverallScoreProps {
  score: number;
}

function getScoreMessage(score: number): string {
  if (score >= 80) return 'Excellent! Your content is highly persuasive.';
  if (score >= 60) return 'Good foundation with room for improvement.';
  return 'Consider applying more psychology principles.';
}

export function OverallScore({ score }: OverallScoreProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-cyan-400" />
            Overall Score
          </span>
          <span className={`text-4xl font-bold ${getScoreColor(score)}`}>
            {score}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={score} className={`h-3 ${getScoreBg(score)}`} />
        <p className="text-sm text-gray-400 mt-2">{getScoreMessage(score)}</p>
      </CardContent>
    </Card>
  );
}
