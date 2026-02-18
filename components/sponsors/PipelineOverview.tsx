'use client';

/**
 * Pipeline Overview
 *
 * @description Kanban-style row showing deal counts per stage with total pipeline value.
 */

import { cn } from '@/lib/utils';
import { DollarSign } from '@/components/icons';
import type { PipelineSummary, DealStage } from '@/hooks/useSponsorCRM';
import { STAGE_LABELS } from '@/hooks/useSponsorCRM';

interface PipelineOverviewProps {
  pipeline: PipelineSummary | null;
  onStageClick?: (stage: DealStage | null) => void;
  selectedStage?: DealStage | null;
  isLoading?: boolean;
  className?: string;
}

const STAGE_COLORS: Record<DealStage, string> = {
  negotiation: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  contracted: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  in_progress: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
  delivered: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  paid: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
  cancelled: 'bg-red-500/10 border-red-500/30 text-red-400',
};

const ACTIVE_STAGES: DealStage[] = ['negotiation', 'contracted', 'in_progress', 'delivered', 'paid'];

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function LoadingSkeleton() {
  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="w-32 h-6 bg-white/5 rounded animate-pulse" />
        <div className="w-24 h-8 bg-white/5 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white/5 rounded-lg p-4">
            <div className="w-16 h-4 bg-white/10 rounded animate-pulse mb-2" />
            <div className="w-8 h-8 bg-white/10 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PipelineOverview({
  pipeline,
  onStageClick,
  selectedStage,
  isLoading,
  className,
}: PipelineOverviewProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!pipeline) {
    return (
      <div className={cn('bg-gray-900/50 border border-white/10 rounded-xl p-6', className)}>
        <p className="text-white/50 text-center">No pipeline data</p>
      </div>
    );
  }

  const totalDeals = ACTIVE_STAGES.reduce((sum, stage) => sum + pipeline.dealsByStage[stage], 0);

  return (
    <div className={cn('bg-gray-900/50 border border-white/10 rounded-xl p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">Deal Pipeline</h3>
          <span className="text-sm text-white/50">({totalDeals} deals)</span>
        </div>
        <div className="flex items-center gap-2 text-cyan-400">
          <DollarSign className="h-5 w-5" />
          <span className="text-xl font-bold">{formatCurrency(pipeline.totalValue)}</span>
        </div>
      </div>

      {/* Stage Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {ACTIVE_STAGES.map((stage) => {
          const count = pipeline.dealsByStage[stage];
          const isSelected = selectedStage === stage;

          return (
            <button
              key={stage}
              onClick={() => onStageClick?.(isSelected ? null : stage)}
              className={cn(
                'rounded-lg p-4 border transition-all text-left',
                STAGE_COLORS[stage],
                isSelected && 'ring-2 ring-white/30',
                'hover:scale-[1.02] active:scale-[0.98]'
              )}
            >
              <p className="text-xs font-medium opacity-80 mb-1">{STAGE_LABELS[stage]}</p>
              <p className="text-2xl font-bold">{count}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PipelineOverview;
