'use client';

/**
 * QueueBulkActions Component
 *
 * Sticky bottom toolbar that appears when one or more posts are selected.
 * Provides reschedule, delete, pause, resume, retry, and clear actions.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Trash2,
  Pause,
  Play,
  RefreshCw,
  X,
  Clock,
} from '@/components/icons';

interface QueueBulkActionsProps {
  selectedCount: number;
  onReschedule: (scheduledAt?: string, offsetHours?: number) => void;
  onDelete: () => void;
  onPause: () => void;
  onResume: () => void;
  onRetryFailed: () => void;
  onClearSelection: () => void;
  hasFailedSelected: boolean;
  hasDraftSelected: boolean;
  hasScheduledSelected: boolean;
}

export function QueueBulkActions({
  selectedCount,
  onReschedule,
  onDelete,
  onPause,
  onResume,
  onRetryFailed,
  onClearSelection,
  hasFailedSelected,
  hasDraftSelected,
  hasScheduledSelected,
}: QueueBulkActionsProps) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState<'exact' | 'offset'>('exact');
  const [exactDate, setExactDate] = useState('');
  const [exactTime, setExactTime] = useState('');
  const [offsetHours, setOffsetHours] = useState(0);

  function handleRescheduleSubmit() {
    if (rescheduleMode === 'exact' && exactDate && exactTime) {
      const iso = new Date(`${exactDate}T${exactTime}`).toISOString();
      onReschedule(iso, undefined);
    } else if (rescheduleMode === 'offset' && offsetHours !== 0) {
      onReschedule(undefined, offsetHours);
    }
    setShowReschedule(false);
    setExactDate('');
    setExactTime('');
    setOffsetHours(0);
  }

  function handleDeleteConfirm() {
    onDelete();
    setShowDelete(false);
  }

  if (selectedCount === 0) return null;

  return (
    <>
      {/* Reschedule popover */}
      {showReschedule && (
        <div className="fixed inset-0 z-40" onClick={() => setShowReschedule(false)}>
          <div
            className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md p-4 rounded-xl bg-gray-900 border border-white/10 shadow-2xl z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-white mb-3">
              Reschedule {selectedCount} post{selectedCount > 1 ? 's' : ''}
            </h3>

            {/* Mode tabs */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  rescheduleMode === 'exact'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                }`}
                onClick={() => setRescheduleMode('exact')}
              >
                Exact Time
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  rescheduleMode === 'offset'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                }`}
                onClick={() => setRescheduleMode('offset')}
              >
                Shift by Hours
              </button>
            </div>

            {rescheduleMode === 'exact' ? (
              <div className="flex gap-2 mb-3">
                <input
                  type="date"
                  value={exactDate}
                  onChange={(e) => setExactDate(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <input
                  type="time"
                  value={exactTime}
                  onChange={(e) => setExactTime(e.target.value)}
                  className="w-32 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="number"
                  value={offsetHours}
                  onChange={(e) => setOffsetHours(Number(e.target.value))}
                  className="w-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  step={1}
                />
                <span className="text-sm text-gray-400">
                  hours (negative = earlier)
                </span>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowReschedule(false)}
                className="text-gray-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRescheduleSubmit}
                className="gradient-primary text-white"
                disabled={
                  rescheduleMode === 'exact'
                    ? !exactDate || !exactTime
                    : offsetHours === 0
                }
              >
                Apply to All
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={() => setShowDelete(false)}>
          <div
            className="w-full max-w-sm p-5 rounded-xl bg-gray-900 border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-2">
              Delete {selectedCount} post{selectedCount > 1 ? 's' : ''}?
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              This action cannot be undone. All selected posts will be permanently removed.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDelete(false)}
                className="text-gray-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDeleteConfirm}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-gray-900/95 backdrop-blur-xl px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-sm font-medium text-white">
            {selectedCount} post{selectedCount > 1 ? 's' : ''} selected
          </span>

          <div className="flex items-center gap-2">
            {/* Reschedule */}
            <Button
              size="sm"
              variant="outline"
              className="bg-white/5 border-white/10 text-white hover:bg-white/10"
              onClick={() => setShowReschedule(true)}
            >
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              Reschedule
            </Button>

            {/* Pause (if scheduled selected) */}
            {hasScheduledSelected && (
              <Button
                size="sm"
                variant="outline"
                className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                onClick={onPause}
              >
                <Pause className="mr-1.5 h-3.5 w-3.5" />
                Pause
              </Button>
            )}

            {/* Resume (if draft selected) */}
            {hasDraftSelected && (
              <Button
                size="sm"
                variant="outline"
                className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                onClick={onResume}
              >
                <Play className="mr-1.5 h-3.5 w-3.5" />
                Resume
              </Button>
            )}

            {/* Retry (if failed selected) */}
            {hasFailedSelected && (
              <Button
                size="sm"
                variant="outline"
                className="bg-white/5 border-white/10 text-cyan-400 hover:bg-white/10"
                onClick={onRetryFailed}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Retry
              </Button>
            )}

            {/* Delete */}
            <Button
              size="sm"
              variant="outline"
              className="bg-white/5 border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>

            {/* Clear selection */}
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-400 hover:text-white"
              onClick={onClearSelection}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
