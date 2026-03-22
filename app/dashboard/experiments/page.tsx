'use client';

/**
 * /dashboard/experiments
 *
 * A/B test and content experiment management dashboard.
 * Wired to /api/dashboard/experiments via SWR.
 */

import useSWR from 'swr';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, FlaskConical, TrendingUp, Users } from 'lucide-react';

interface ExperimentVariant {
  id: string;
  name: string;
  traffic: number;       // percent
  conversions: number;
  conversionRate: number;
  isWinner?: boolean;
}

interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  status: 'running' | 'completed' | 'paused' | 'draft';
  platform: string;
  startedAt: string;
  endedAt?: string;
  totalParticipants: number;
  significance: number;  // 0–100 statistical significance
  variants: ExperimentVariant[];
  winner?: string;
}

interface ExperimentsData {
  activeCount: number;
  completedCount: number;
  avgLift: number;
  experiments: Experiment[];
}

async function fetcher(url: string): Promise<ExperimentsData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load experiments (${res.status})`);
  return res.json();
}

const STATUS_STYLES: Record<Experiment['status'], string> = {
  running: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  completed: 'text-white/40 border-white/20 bg-white/5',
  paused: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  draft: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
};

export default function ExperimentsPage() {
  const { data, error, isLoading } = useSWR<ExperimentsData>(
    '/api/dashboard/experiments',
    fetcher,
    { refreshInterval: 60_000 }
  );

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="border-b border-white/[0.06] pb-6">
          <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
          <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
              <div className="h-4 w-24 bg-white/[0.05] rounded-sm mb-2" />
              <div className="h-8 w-12 bg-white/[0.05] rounded-sm" />
            </div>
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-6 space-y-4">
            <div className="h-5 w-48 bg-white/[0.05] rounded-sm" />
            <div className="h-4 w-full bg-white/[0.05] rounded-sm" />
            <div className="grid grid-cols-2 gap-3">
              {[0, 1].map((j) => (
                <div key={j} className="h-16 bg-white/[0.05] rounded-sm" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load experiments. {error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="border-b border-white/[0.06] pb-6">
        <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Optimisation</p>
        <h1 className="text-2xl font-semibold text-white">Experiments</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="h-3.5 w-3.5 text-amber-400/60" />
            <p className="text-xs text-white/40">Active Tests</p>
          </div>
          <p className="text-2xl font-semibold text-white">{data.activeCount}</p>
        </div>
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <p className="text-xs text-white/40 mb-2">Completed</p>
          <p className="text-2xl font-semibold text-white">{data.completedCount}</p>
        </div>
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400/60" />
            <p className="text-xs text-white/40">Avg Lift</p>
          </div>
          <p className="text-2xl font-semibold text-emerald-400">+{data.avgLift.toFixed(1)}%</p>
        </div>
      </div>

      <div className="space-y-4">
        {data.experiments.map((exp) => (
          <div key={exp.id} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden">
            <div className="p-4 border-b border-white/[0.04]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-white">{exp.name}</h3>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_STYLES[exp.status]}`}>
                      {exp.status}
                    </Badge>
                    {exp.significance >= 95 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-400 border-amber-400/30 bg-amber-400/10">
                        Significant
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-white/40">{exp.hypothesis}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-white/25 capitalize">{exp.platform}</span>
                    <span className="text-[10px] text-white/25 flex items-center gap-1">
                      <Users className="h-3 w-3" /> {exp.totalParticipants.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-white/25">
                      Significance: {exp.significance}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-white/[0.04]">
              {exp.variants.map((variant) => (
                <div
                  key={variant.id}
                  className={`p-4 ${variant.isWinner ? 'bg-emerald-500/5' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-medium text-white">{variant.name}</p>
                    {variant.isWinner && (
                      <span className="text-[10px] text-emerald-400 border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 rounded-sm">
                        Winner
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-white/30">Traffic</p>
                      <p className="text-xs font-medium text-white">{variant.traffic}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30">Conv.</p>
                      <p className="text-xs font-medium text-white">{variant.conversions.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30">Rate</p>
                      <p className={`text-xs font-medium ${variant.isWinner ? 'text-emerald-400' : 'text-white'}`}>
                        {variant.conversionRate.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {data.experiments.length === 0 && (
          <div className="border-[0.5px] border-white/[0.06] rounded-sm p-8 text-center">
            <FlaskConical className="h-8 w-8 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/30">No experiments yet. Start testing to optimise your content.</p>
          </div>
        )}
      </div>
    </div>
  );
}
