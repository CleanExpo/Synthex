'use client';

/**
 * Task Toolbar Component
 * Search, filters, and view toggle for tasks
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Grid, List } from '@/components/icons';
// Aliases for Lucide icon names
const KanbanSquare = Grid;
const LayoutList = List;
import { typeConfig, priorityConfig } from './task-config';
import type { TaskType, TaskPriority } from './types';

type ViewMode = 'kanban' | 'list';

interface TaskToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterType: TaskType | 'all';
  onFilterTypeChange: (type: TaskType | 'all') => void;
  filterPriority: TaskPriority | 'all';
  onFilterPriorityChange: (priority: TaskPriority | 'all') => void;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function TaskToolbar({
  searchQuery,
  onSearchChange,
  filterType,
  onFilterTypeChange,
  filterPriority,
  onFilterPriorityChange,
  view,
  onViewChange,
}: TaskToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tasks..."
            className="pl-10 w-64 bg-white/5 border-white/10"
          />
        </div>

        {/* Type Filter */}
        <Select value={filterType} onValueChange={(v) => onFilterTypeChange(v as TaskType | 'all')}>
          <SelectTrigger className="w-32 bg-white/5 border-white/10">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(typeConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority Filter */}
        <Select value={filterPriority} onValueChange={(v) => onFilterPriorityChange(v as TaskPriority | 'all')}>
          <SelectTrigger className="w-32 bg-white/5 border-white/10">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {Object.entries(priorityConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewChange('kanban')}
          className={view === 'kanban' ? 'bg-white/10' : ''}
        >
          <KanbanSquare className="w-4 h-4 mr-1" />
          Kanban
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewChange('list')}
          className={view === 'list' ? 'bg-white/10' : ''}
        >
          <LayoutList className="w-4 h-4 mr-1" />
          List
        </Button>
      </div>
    </div>
  );
}
