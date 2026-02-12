'use client';

/**
 * Task List Row Component
 * Displays a single task in row format for List view
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Calendar,
  Edit,
  Trash2,
} from 'lucide-react';
import { TaskTypeBadge, TaskStatusBadge, TaskPriorityBadge, AssigneeAvatars } from './task-badges';
import type { Task, TaskStatus } from './types';

interface TaskListRowProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}

export function TaskListRow({ task, onEdit, onDelete, onStatusChange }: TaskListRowProps) {
  const dueDate = new Date(task.dueDate);
  const isOverdue = dueDate < new Date() && task.status !== 'done';
  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] transition-all group">
      <Checkbox
        checked={task.status === 'done'}
        onCheckedChange={(checked) => onStatusChange(task.id, checked ? 'done' : 'todo')}
        className="data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={`font-medium truncate ${task.status === 'done' ? 'text-slate-500 line-through' : 'text-white'}`}>
            {task.title}
          </h4>
          {task.campaignName && (
            <Badge variant="outline" className="text-xs bg-white/5 border-white/10">
              {task.campaignName}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <TaskTypeBadge type={task.type} />
          {task.subtasks.length > 0 && (
            <span>{completedSubtasks}/{task.subtasks.length} subtasks</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <TaskStatusBadge status={task.status} />
        <TaskPriorityBadge priority={task.priority} />
        <AssigneeAvatars assignees={task.assignees} max={2} />
        <div className={`flex items-center gap-1 text-sm ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
          <Calendar className="w-4 h-4" />
          {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-slate-900/95 border-white/10">
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-red-400">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
