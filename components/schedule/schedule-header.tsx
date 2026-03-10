'use client';

/**
 * Schedule Header Component
 * Header with import/export/create actions
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Upload, Download, Plus, Loader2, List } from '@/components/icons';

interface ScheduleHeaderProps {
  isCreating: boolean;
  onImport: () => void;
  onExport: () => void;
  onCreate: () => void;
}

export function ScheduleHeader({ isCreating, onImport, onExport, onCreate }: ScheduleHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Content Schedule</h1>
        <p className="text-slate-400 mt-1">
          Drag and drop to reschedule your content across all platforms
        </p>
      </div>
      <div className="flex space-x-3 mt-4 sm:mt-0">
        <Link href="/dashboard/schedule/queue">
          <Button
            variant="outline"
            className="bg-white/5 border-white/10 text-white hover:bg-white/10"
          >
            <List className="mr-2 h-4 w-4" />
            Queue
          </Button>
        </Link>
        <Button
          onClick={onImport}
          variant="outline"
          className="bg-white/5 border-white/10 text-white hover:bg-white/10"
        >
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
        <Button
          onClick={onExport}
          variant="outline"
          className="bg-white/5 border-white/10 text-white hover:bg-white/10"
        >
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <Button
          onClick={onCreate}
          disabled={isCreating}
          className="gradient-primary text-white"
        >
          {isCreating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Create Post
        </Button>
      </div>
    </div>
  );
}
