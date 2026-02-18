'use client';

/**
 * Deal List
 *
 * @description List of deals for a sponsor with stage badges and deliverable progress.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Edit, Trash2, Calendar, DollarSign, Package } from '@/components/icons';
import type { SponsorDeal, DealStage } from '@/hooks/useSponsorCRM';
import { STAGE_LABELS } from '@/hooks/useSponsorCRM';
import { DeliverableList } from './DeliverableList';

interface DealListProps {
  deals: SponsorDeal[];
  sponsorId: string;
  onEdit?: (deal: SponsorDeal) => void;
  onDelete?: (deal: SponsorDeal) => void;
  onAddDeliverable?: (deal: SponsorDeal) => void;
  onEditDeliverable?: (deal: SponsorDeal, deliverableId: string) => void;
  onDeleteDeliverable?: (deal: SponsorDeal, deliverableId: string) => void;
  onToggleDeliverableStatus?: (deal: SponsorDeal, deliverableId: string) => void;
  isLoading?: boolean;
  className?: string;
}

const STAGE_COLORS: Record<DealStage, string> = {
  negotiation: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  contracted: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  in_progress: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  paid: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function DealRow({
  deal,
  sponsorId,
  onEdit,
  onDelete,
  onAddDeliverable,
  onEditDeliverable,
  onDeleteDeliverable,
  onToggleDeliverableStatus,
}: {
  deal: SponsorDeal;
  sponsorId: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onAddDeliverable?: () => void;
  onEditDeliverable?: (deliverableId: string) => void;
  onDeleteDeliverable?: (deliverableId: string) => void;
  onToggleDeliverableStatus?: (deliverableId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const deliverables = deal.deliverables ?? [];
  const completedCount = deliverables.filter(d => d.status === 'approved').length;
  const totalCount = deliverables.length;

  return (
    <div className="border-b border-white/5 last:border-0">
      {/* Deal Row */}
      <div
        className="flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Expand Toggle */}
        <button className="text-white/40 hover:text-white">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white truncate">{deal.title}</h4>
          {deal.description && (
            <p className="text-sm text-white/50 truncate">{deal.description}</p>
          )}
        </div>

        {/* Value */}
        <div className="flex items-center gap-1.5 text-sm">
          <DollarSign className="h-4 w-4 text-emerald-400" />
          <span className="text-white font-medium">{formatCurrency(deal.value, deal.currency)}</span>
        </div>

        {/* Stage Badge */}
        <span
          className={cn(
            'px-2 py-1 text-xs font-medium rounded-full border whitespace-nowrap',
            STAGE_COLORS[deal.stage]
          )}
        >
          {STAGE_LABELS[deal.stage]}
        </span>

        {/* Date Range */}
        <div className="flex items-center gap-1.5 text-sm text-white/50 min-w-[120px]">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(deal.startDate)}</span>
        </div>

        {/* Deliverable Progress */}
        <div className="flex items-center gap-1.5 text-sm text-white/50 min-w-[80px]">
          <Package className="h-4 w-4" />
          <span>{completedCount}/{totalCount}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Deliverables (Expanded) */}
      {isExpanded && (
        <div className="pl-12 pr-4 pb-4">
          <DeliverableList
            deliverables={deliverables}
            onAdd={onAddDeliverable}
            onEdit={onEditDeliverable}
            onDelete={onDeleteDeliverable}
            onToggleStatus={onToggleDeliverableStatus}
          />
        </div>
      )}
    </div>
  );
}

export function DealList({
  deals,
  sponsorId,
  onEdit,
  onDelete,
  onAddDeliverable,
  onEditDeliverable,
  onDeleteDeliverable,
  onToggleDeliverableStatus,
  isLoading,
  className,
}: DealListProps) {
  if (isLoading) {
    return (
      <div className={cn('bg-gray-900/50 border border-white/10 rounded-xl overflow-hidden', className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-white/5">
            <div className="w-5 h-5 bg-white/5 rounded animate-pulse" />
            <div className="flex-1">
              <div className="w-48 h-5 bg-white/5 rounded animate-pulse mb-2" />
              <div className="w-32 h-4 bg-white/5 rounded animate-pulse" />
            </div>
            <div className="w-20 h-6 bg-white/5 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className={cn('bg-gray-900/50 border border-white/10 rounded-xl p-8 text-center', className)}>
        <Package className="h-10 w-10 text-white/20 mx-auto mb-3" />
        <p className="text-white/50">No deals yet for this sponsor</p>
      </div>
    );
  }

  return (
    <div className={cn('bg-gray-900/50 border border-white/10 rounded-xl overflow-hidden', className)}>
      {deals.map((deal) => (
        <DealRow
          key={deal.id}
          deal={deal}
          sponsorId={sponsorId}
          onEdit={() => onEdit?.(deal)}
          onDelete={() => onDelete?.(deal)}
          onAddDeliverable={() => onAddDeliverable?.(deal)}
          onEditDeliverable={(id) => onEditDeliverable?.(deal, id)}
          onDeleteDeliverable={(id) => onDeleteDeliverable?.(deal, id)}
          onToggleDeliverableStatus={(id) => onToggleDeliverableStatus?.(deal, id)}
        />
      ))}
    </div>
  );
}

export default DealList;
