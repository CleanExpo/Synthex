'use client';

/**
 * Kanban Column Component
 * Displays a column of tasks for a specific status in Kanban view
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from '@/components/icons';
import { TaskCard } from './task-card';
import { statusConfig } from './task-config';
import type { Task, TaskStatus } from './types';

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}

export function KanbanColumn({
  status,
  tasks,
  onEdit,
  onDelete,
  onStatusChange,
}: KanbanColumnProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex flex-col min-w-[320px] max-w-[320px]">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-white">{config.label}</h3>
          <Badge variant="outline" className="ml-1 bg-white/5 text-slate-400 border-white/10">
            {tasks.length}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-32 rounded-lg border-2 border-dashed border-white/10 text-slate-500 text-sm">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}
