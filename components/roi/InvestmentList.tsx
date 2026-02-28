'use client';

/**
 * Investment List
 *
 * @description Table of investment entries with edit/delete actions.
 */

import { useState } from 'react';
import { Edit, Trash2, ChevronDown, Clock, DollarSign } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ContentInvestment, InvestmentType, InvestmentCategory } from '@/lib/roi/roi-service';

interface InvestmentListProps {
  entries: ContentInvestment[];
  onEdit: (entry: ContentInvestment) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
  className?: string;
}

const TYPE_STYLES: Record<InvestmentType, { bg: string; text: string; label: string }> = {
  time: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Time' },
  money: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Money' },
};

const CATEGORY_STYLES: Record<InvestmentCategory, { bg: string; text: string; label: string }> = {
  creation: { bg: 'bg-violet-500/10', text: 'text-violet-400', label: 'Creation' },
  equipment: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', label: 'Equipment' },
  software: { bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Software' },
  promotion: { bg: 'bg-pink-500/10', text: 'text-pink-400', label: 'Promotion' },
  other: { bg: 'bg-gray-500/10', text: 'text-gray-400', label: 'Other' },
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  return `${hours.toFixed(1)} hrs`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-gray-900/30 border border-white/5 rounded-lg p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-6 bg-white/5 rounded animate-pulse" />
            <div className="w-20 h-6 bg-white/5 rounded animate-pulse" />
            <div className="w-32 h-5 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-20 h-6 bg-white/5 rounded animate-pulse" />
            <div className="w-8 h-8 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function InvestmentList({
  entries,
  onEdit,
  onDelete,
  isLoading,
  className,
}: InvestmentListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!entries || entries.length === 0) {
    return (
      <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-8 text-center', className)}>
        <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-white mb-1">No Investments Tracked</h3>
        <p className="text-gray-500 text-sm">
          Add your first investment to start tracking ROI.
        </p>
      </div>
    );
  }

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      onDelete(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {entries.map((entry) => {
        const typeStyle = TYPE_STYLES[entry.type];
        const categoryStyle = CATEGORY_STYLES[entry.category];
        const isExpanded = expanded === entry.id;
        const isConfirmingDelete = deleteConfirm === entry.id;

        return (
          <div
            key={entry.id}
            className="bg-gray-900/30 border border-white/5 rounded-lg overflow-hidden hover:border-white/10 transition-colors"
          >
            {/* Main row */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Type badge */}
                <span className={cn('px-2 py-1 rounded text-xs font-medium flex items-center gap-1', typeStyle.bg, typeStyle.text)}>
                  {entry.type === 'time' ? (
                    <Clock className="w-3 h-3" />
                  ) : (
                    <DollarSign className="w-3 h-3" />
                  )}
                  {typeStyle.label}
                </span>

                {/* Category badge */}
                <span className={cn('px-2 py-1 rounded text-xs font-medium', categoryStyle.bg, categoryStyle.text)}>
                  {categoryStyle.label}
                </span>

                {/* Description */}
                <span className="text-sm text-gray-300 truncate flex-1 hidden sm:block">
                  {entry.description || 'No description'}
                </span>

                {/* Date */}
                <span className="text-sm text-gray-500 hidden md:block">
                  {formatDate(entry.investedAt)}
                </span>
              </div>

              <div className="flex items-center gap-3 ml-4">
                {/* Amount */}
                <span className="text-sm font-medium text-white">
                  {entry.type === 'time'
                    ? formatHours(entry.amount)
                    : formatCurrency(entry.amount, entry.currency || 'USD')}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-white"
                    aria-label="Edit investment"
                    onClick={() => onEdit(entry)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-8 w-8',
                      isConfirmingDelete
                        ? 'text-red-400 bg-red-500/10'
                        : 'text-gray-400 hover:text-red-400'
                    )}
                    aria-label={isConfirmingDelete ? 'Confirm delete investment' : 'Delete investment'}
                    onClick={() => handleDelete(entry.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-white sm:hidden"
                    aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                    onClick={() => setExpanded(isExpanded ? null : entry.id)}
                  >
                    <ChevronDown className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
                  </Button>
                </div>
              </div>
            </div>

            {/* Expanded details (mobile) */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-2 text-sm sm:hidden">
                <div className="flex justify-between">
                  <span className="text-gray-500">Description</span>
                  <span className="text-gray-300">{entry.description || 'None'}</span>
                </div>
                {entry.platform && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Platform</span>
                    <span className="text-gray-300">{entry.platform}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span className="text-gray-300">{formatDate(entry.investedAt)}</span>
                </div>
              </div>
            )}

            {/* Delete confirmation */}
            {isConfirmingDelete && (
              <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-sm text-red-400">
                Click delete again to confirm
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default InvestmentList;
