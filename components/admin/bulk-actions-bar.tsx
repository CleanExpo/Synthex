'use client';

/**
 * Bulk Actions Bar Component
 * Selection count and bulk action buttons
 */

import { Button } from '@/components/ui/button';
import { Download, Ban, CheckCircle, Trash2 } from '@/components/icons';
import type { BulkAction } from './types';

interface BulkActionsBarProps {
  selectedCount: number;
  onClear: () => void;
  onBulkAction: (action: BulkAction) => void;
  isProcessing: boolean;
}

export function BulkActionsBar({
  selectedCount,
  onClear,
  onBulkAction,
  isProcessing
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center justify-between p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg mb-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-cyan-300">
          {selectedCount} user(s) selected
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          className="text-gray-400 hover:text-white"
        >
          Clear
        </Button>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onBulkAction('export')}
          disabled={isProcessing}
          className="border-white/10"
        >
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onBulkAction('ban')}
          disabled={isProcessing}
          className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
        >
          <Ban className="w-4 h-4 mr-1" />
          Ban
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onBulkAction('unban')}
          disabled={isProcessing}
          className="border-green-500/50 text-green-400 hover:bg-green-500/10"
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          Unban
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onBulkAction('delete')}
          disabled={isProcessing}
          className="border-red-500/50 text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );
}
