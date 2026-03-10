'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Shield, Eye, Award, Star, Check } from '@/components/icons';

interface EEATScore {
  overall: number;
  experience: number;
  expertise: number;
  authoritativeness: number;
  trustworthiness: number;
}

interface EEATScoreCardProps {
  score: EEATScore | null;
  tier?: string;
  loading?: boolean;
}

const dimensions = [
  { key: 'experience', label: 'Experience', icon: Eye, weight: '20%', color: 'text-cyan-400' },
  { key: 'expertise', label: 'Expertise', icon: Award, weight: '25%', color: 'text-purple-400' },
  { key: 'authoritativeness', label: 'Authority', icon: Star, weight: '25%', color: 'text-amber-400' },
  { key: 'trustworthiness', label: 'Trust', icon: Shield, weight: '30%', color: 'text-emerald-400' },
] as const;

const tierConfig: Record<string, { color: string }> = {
  exceptional: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  strong: { color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  moderate: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  weak: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  very_low: { color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

export function EEATScoreCard({ score, tier, loading }: EEATScoreCardProps) {
  if (loading) {
    return (
      <Card className="bg-white/[0.02] border-white/[0.08]">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/10 rounded w-1/3" />
            <div className="h-24 bg-white/10 rounded" />
            <div className="space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-4 bg-white/10 rounded" />)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!score) return null;

  const tierStyle = tierConfig[tier || 'moderate'] || tierConfig.moderate;

  return (
    <Card className="bg-white/[0.02] border-white/[0.08]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-400" />
            E-E-A-T Score
          </CardTitle>
          {tier && <Badge className={tierStyle.color}>{tier.replace('_', ' ')}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center py-4">
          <div className="text-6xl font-bold text-white">{score.overall}</div>
          <div className="text-sm text-gray-400 mt-1">out of 100</div>
        </div>

        <div className="space-y-3">
          {dimensions.map(({ key, label, icon: Icon, weight, color }) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span>{label}</span>
                  <span className="text-gray-500 text-xs">({weight})</span>
                </div>
                <span className="text-white font-medium">{score[key as keyof EEATScore]}</span>
              </div>
              <Progress value={score[key as keyof EEATScore]} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
