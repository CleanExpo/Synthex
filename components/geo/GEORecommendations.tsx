'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check, TrendingUp, Zap } from '@/components/icons';

interface Recommendation {
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: number;
}

interface GEORecommendationsProps {
  recommendations: Recommendation[];
}

const priorityConfig = {
  critical: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertTriangle },
  high: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Zap },
  medium: { color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: TrendingUp },
  low: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Check },
};

export function GEORecommendations({ recommendations }: GEORecommendationsProps) {
  if (!recommendations?.length) return null;

  return (
    <Card className="bg-white/[0.02] border-white/[0.08]">
      <CardHeader>
        <CardTitle className="text-white text-lg">Recommendations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recommendations.map((rec, i) => {
            const config = priorityConfig[rec.priority];
            const Icon = config.icon;
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <Icon className="h-5 w-5 mt-0.5 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{rec.title}</span>
                    <Badge className={`${config.color} text-xs`}>{rec.priority}</Badge>
                    <Badge className="bg-white/5 text-gray-400 border-white/10 text-xs">+{rec.impact}pts</Badge>
                  </div>
                  <p className="text-xs text-gray-400">{rec.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
