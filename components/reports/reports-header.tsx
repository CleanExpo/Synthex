'use client';

/**
 * Reports Header Component
 * Page title and action buttons
 */

import { Button } from '@/components/ui/button';
import { RefreshCw, Plus } from '@/components/icons';

interface ReportsHeaderProps {
  isLoading: boolean;
  onRefresh: () => void;
  onNewReport: () => void;
}

export function ReportsHeader({ isLoading, onRefresh, onNewReport }: ReportsHeaderProps) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Reports</h1>
        <p className="text-gray-400">Generate and download comprehensive reports</p>
      </div>
      <div className="flex gap-3">
        <Button onClick={onRefresh} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button className="gradient-primary text-white" onClick={onNewReport}>
          <Plus className="w-4 h-4 mr-2" />
          New Report
        </Button>
      </div>
    </div>
  );
}
