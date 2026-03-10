'use client';

/**
 * Psychology Principles Card
 * Displays individual psychology principles with scores
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Brain, Lightbulb } from '@/components/icons';
import { PRINCIPLE_ICONS, getScoreColor, getDefaultPrincipleIcon } from './config';
import type { PsychologyPrinciple } from './types';

interface PrinciplesCardProps {
  principles: PsychologyPrinciple[];
}

export function PrinciplesCard({ principles }: PrinciplesCardProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Brain className="w-5 h-5 mr-2 text-cyan-400" />
          Psychology Principles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {principles.map((principle, index) => {
          const Icon = PRINCIPLE_ICONS[principle.name] || getDefaultPrincipleIcon();
          return (
            <div key={index} className="p-3 bg-white/5 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-cyan-400" />
                  <span className="font-medium text-white">{principle.name}</span>
                </div>
                <span className={`font-bold ${getScoreColor(principle.score)}`}>
                  {principle.score}%
                </span>
              </div>
              <Progress value={principle.score} className="h-2 mb-2" />
              <p className="text-xs text-gray-400">{principle.description}</p>
              <p className="text-xs text-cyan-300 mt-1">
                <Lightbulb className="w-3 h-3 inline mr-1" />
                {principle.recommendation}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
