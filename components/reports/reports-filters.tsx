'use client';

/**
 * Reports Filters Component
 * Filter buttons for report types
 */

import { Button } from '@/components/ui/button';
import { Filter } from '@/components/icons';
import { reportTypes } from './reports-config';

interface ReportsFiltersProps {
  filterType: string | null;
  onFilterChange: (type: string | null) => void;
}

export function ReportsFilters({ filterType, onFilterChange }: ReportsFiltersProps) {
  return (
    <div className="flex gap-2 items-center">
      <Filter className="w-4 h-4 text-gray-400" />
      <span className="text-sm text-gray-400">Filter by type:</span>
      <Button
        size="sm"
        variant={filterType === null ? 'default' : 'outline'}
        onClick={() => onFilterChange(null)}
      >
        All
      </Button>
      {reportTypes.map((type) => (
        <Button
          key={type.id}
          size="sm"
          variant={filterType === type.id ? 'default' : 'outline'}
          onClick={() => onFilterChange(type.id)}
        >
          {type.name}
        </Button>
      ))}
    </div>
  );
}
