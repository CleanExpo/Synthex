'use client';

/**
 * Revenue Entry List
 *
 * @description Table of revenue entries with edit/delete actions.
 */

import { useState } from 'react';
import { Edit, Trash2, ChevronDown, DollarSign } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RevenueEntry, RevenueSource } from '@/lib/revenue/revenue-service';

interface RevenueEntryListProps {
  entries: RevenueEntry[];
  onEdit: (entry: RevenueEntry) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
  className?: string;
}

const SOURCE_COLORS: Record<RevenueSource, { bg: string; text: string }> = {
  sponsorship: { bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
  affiliate: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  ads: { bg: 'bg-violet-500/10', text: 'text-violet-400' },
  tips: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  merchandise: { bg: 'bg-pink-500/10', text: 'text-pink-400' },
  other: { bg: 'bg-gray-500/10', text: 'text-gray-400' },
};

const SOURCE_LABELS: Record<RevenueSource, string> = {
  sponsorship: 'Sponsorship',
  affiliate: 'Affiliate',
  ads: 'Ad Revenue',
  tips: 'Tips',
  merchandise: 'Merchandise',
  other: 'Other',
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
            <div className="w-20 h-6 bg-white/5 rounded animate-pulse" />
            <div className="w-32 h-5 bg-white/5 rounded animate-pulse" />
            <div className="w-24 h-5 bg-white/5 rounded animate-pulse" />
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

export function RevenueEntryList({
  entries,
  onEdit,
  onDelete,
  isLoading,
  className,
}: RevenueEntryListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!entries || entries.length === 0) {
    return (
      <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-8 text-center', className)}>
        <DollarSign className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-white mb-1">No Revenue Entries</h3>
        <p className="text-gray-500 text-sm">
          Add your first revenue entry to start tracking your income.
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
      // Auto-cancel after 3 seconds
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {entries.map((entry) => {
        const colors = SOURCE_COLORS[entry.source];
        const isExpanded = expanded === entry.id;
        const isConfirmingDelete = deleteConfirm === entry.id;

        return (
          <div
            key={entry.id}
            className="bg-gray-900/30 border border-white/5 rounded-lg overflow-hidden hover:border-white/10 transition-colors"
          >
            {/* Main row */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Source badge */}
                <span className={cn('px-2.5 py-1 rounded text-xs font-medium', colors.bg, colors.text)}>
                  {SOURCE_LABELS[entry.source]}
                </span>

                {/* Description */}
                <span className="text-sm text-gray-300 truncate flex-1">
                  {entry.description || entry.brandName || 'No description'}
                </span>

                {/* Platform */}
                {entry.platform && (
                  <span className="text-xs text-gray-500 hidden md:block">
                    {entry.platform}
                  </span>
                )}

                {/* Date */}
                <span className="text-sm text-gray-500 hidden sm:block">
                  {formatDate(entry.paidAt)}
                </span>
              </div>

              <div className="flex items-center gap-3 ml-4">
                {/* Amount */}
                <span className="text-sm font-medium text-white">
                  {formatCurrency(entry.amount, entry.currency)}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-white"
                    aria-label="Edit revenue entry"
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
                    aria-label={isConfirmingDelete ? 'Confirm delete revenue entry' : 'Delete revenue entry'}
                    onClick={() => handleDelete(entry.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-white md:hidden"
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
              <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-2 text-sm md:hidden">
                {entry.platform && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Platform</span>
                    <span className="text-gray-300">{entry.platform}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span className="text-gray-300">{formatDate(entry.paidAt)}</span>
                </div>
                {entry.brandName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Brand</span>
                    <span className="text-gray-300">{entry.brandName}</span>
                  </div>
                )}
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

export default RevenueEntryList;
