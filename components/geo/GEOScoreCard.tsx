'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Globe, TrendingUp, Eye, Database, Shield } from '@/components/icons';

interface GEOScore {
  overall: number;
  citability: number;
  structure: number;
  multiModal: number;
  authority: number;
  technical: number;
}

interface GEOScoreCardProps {
  score: GEOScore | null;
  loading?: boolean;
}

const scoreDimensions = [
  { key: 'citability', label: 'Citability', icon: Eye, weight: '25%', color: 'bg-cyan-500' },
  { key: 'structure', label: 'Structure', icon: Database, weight: '20%', color: 'bg-purple-500' },
  { key: 'multiModal', label: 'Multi-Modal', icon: Globe, weight: '15%', color: 'bg-amber-500' },
  { key: 'authority', label: 'Authority', icon: Shield, weight: '20%', color: 'bg-emerald-500' },
  { key: 'technical', label: 'Technical', icon: TrendingUp, weight: '20%', color: 'bg-rose-500' },
] as const;

function getScoreTier(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Excellent', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
  if (score >= 60) return { label: 'Good', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' };
  if (score >= 40) return { label: 'Needs Work', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
  return { label: 'Poor', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
}

export function GEOScoreCard({ score, loading }: GEOScoreCardProps) {
  if (loading) {
    return (
      <Card className="bg-white/[0.02] border-white/[0.08]">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/10 rounded w-1/3" />
            <div className="h-24 bg-white/10 rounded" />
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-white/10 rounded" />)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!score) return null;

  const tier = getScoreTier(score.overall);

  return (
    <Card className="bg-white/[0.02] border-white/[0.08]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Globe className="h-5 w-5 text-cyan-400" />
            GEO Score
          </CardTitle>
          <Badge className={tier.color}>{tier.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="text-center py-4">
          <div className="text-6xl font-bold text-white">{score.overall}</div>
          <div className="text-sm text-gray-400 mt-1">out of 100</div>
        </div>

        {/* Dimension Breakdown */}
        <div className="space-y-3">
          {scoreDimensions.map(({ key, label, icon: Icon, weight, color }) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  <span className="text-gray-500 text-xs">({weight})</span>
                </div>
                <span className="text-white font-medium">{score[key as keyof GEOScore]}</span>
              </div>
              <Progress value={score[key as keyof GEOScore]} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
