'use client';

/**
 * Deliverable List
 *
 * @description List of deliverables within a deal with status badges and actions.
 */

import { cn } from '@/lib/utils';
import { Plus, Edit, Trash2, Calendar, CheckCircle2, Circle, ExternalLink } from '@/components/icons';
import type { DealDeliverable, DeliverableType, DeliverableStatus } from '@/hooks/useSponsorCRM';
import { TYPE_LABELS, DELIVERABLE_STATUS_LABELS } from '@/hooks/useSponsorCRM';

interface DeliverableListProps {
  deliverables: DealDeliverable[];
  onAdd?: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleStatus?: (id: string) => void;
  isLoading?: boolean;
  className?: string;
}

const TYPE_COLORS: Record<DeliverableType, string> = {
  post: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  story: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  reel: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  video: 'bg-red-500/10 text-red-400 border-red-500/30',
  mention: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  review: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  other: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
};

const STATUS_COLORS: Record<DeliverableStatus, string> = {
  pending: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  in_progress: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  submitted: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/30',
};

function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function DeliverableRow({
  deliverable,
  onEdit,
  onDelete,
  onToggleStatus,
}: {
  deliverable: DealDeliverable;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleStatus?: () => void;
}) {
  const isCompleted = deliverable.status === 'approved';

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg transition-colors group">
      {/* Completion Toggle */}
      <button
        onClick={onToggleStatus}
        className={cn(
          'flex-shrink-0 transition-colors',
          isCompleted ? 'text-emerald-400' : 'text-white/30 hover:text-white/50'
        )}
      >
        {isCompleted ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', isCompleted ? 'text-white/50 line-through' : 'text-white')}>
          {deliverable.title}
        </p>
      </div>

      {/* Type Badge */}
      <span
        className={cn(
          'px-2 py-0.5 text-xs font-medium rounded-full border whitespace-nowrap',
          TYPE_COLORS[deliverable.type]
        )}
      >
        {TYPE_LABELS[deliverable.type]}
      </span>

      {/* Platform */}
      {deliverable.platform && (
        <span className="text-xs text-white/40 whitespace-nowrap">
          {deliverable.platform}
        </span>
      )}

      {/* Status Badge */}
      <span
        className={cn(
          'px-2 py-0.5 text-xs font-medium rounded-full border whitespace-nowrap',
          STATUS_COLORS[deliverable.status]
        )}
      >
        {DELIVERABLE_STATUS_LABELS[deliverable.status]}
      </span>

      {/* Due Date */}
      <div className="flex items-center gap-1 text-xs text-white/40 min-w-[70px]">
        <Calendar className="h-3.5 w-3.5" />
        <span>{formatDate(deliverable.dueDate)}</span>
      </div>

      {/* Content Link */}
      {deliverable.contentUrl && (
        <a
          href={deliverable.contentUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 text-white/40 hover:text-cyan-400 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function DeliverableList({
  deliverables,
  onAdd,
  onEdit,
  onDelete,
  onToggleStatus,
  isLoading,
  className,
}: DeliverableListProps) {
  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <div className="w-5 h-5 bg-white/5 rounded-full animate-pulse" />
            <div className="flex-1">
              <div className="w-32 h-4 bg-white/5 rounded animate-pulse" />
            </div>
            <div className="w-16 h-5 bg-white/5 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {/* Add Button */}
      <button
        onClick={onAdd}
        className="flex items-center gap-2 w-full p-3 text-sm text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
      >
        <Plus className="h-4 w-4" />
        <span>Add deliverable</span>
      </button>

      {/* Deliverable Rows */}
      {deliverables.map((deliverable) => (
        <DeliverableRow
          key={deliverable.id}
          deliverable={deliverable}
          onEdit={() => onEdit?.(deliverable.id)}
          onDelete={() => onDelete?.(deliverable.id)}
          onToggleStatus={() => onToggleStatus?.(deliverable.id)}
        />
      ))}

      {deliverables.length === 0 && (
        <p className="text-center text-sm text-white/30 py-4">
          No deliverables yet
        </p>
      )}
    </div>
  );
}

export default DeliverableList;
