'use client';

/**
 * Task Card Component
 * Displays a single task in card format for Kanban view
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Calendar,
  Circle,
  CheckCircle,
  Pause,
  Play,
  Trash2,
  Edit,
  Eye,
  MessageSquare,
  Link2,
} from '@/components/icons';
import { TaskTypeBadge, TaskPriorityBadge, AssigneeAvatars } from './task-badges';
import type { Task, TaskStatus } from './types';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}

export function TaskCard({ task, onEdit, onDelete, onStatusChange }: TaskCardProps) {
  const dueDate = new Date(task.dueDate);
  const isOverdue = dueDate < new Date() && task.status !== 'done';
  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;

  return (
    <Card variant="glass" className="hover:bg-white/[0.04] transition-all cursor-pointer group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <TaskTypeBadge type={task.type} />
            <TaskPriorityBadge priority={task.priority} />
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
                Edit Task
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'todo')}>
                <Circle className="w-4 h-4 mr-2" />
                Set To Do
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'in_progress')}>
                <Play className="w-4 h-4 mr-2" />
                Set In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'review')}>
                <Pause className="w-4 h-4 mr-2" />
                Set In Review
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'done')}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Set Done
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-red-400">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h3 className="font-semibold text-white mb-2 line-clamp-2">{task.title}</h3>
        <p className="text-sm text-slate-400 mb-3 line-clamp-2">{task.description}</p>

        {/* Subtasks Progress */}
        {task.subtasks.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Subtasks</span>
              <span>{completedSubtasks}/{task.subtasks.length}</span>
            </div>
            <Progress value={(completedSubtasks / task.subtasks.length) * 100} className="h-1" />
          </div>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {task.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded bg-white/5 text-slate-400">
                {tag}
              </span>
            ))}
            {task.tags.length > 3 && (
              <span className="text-xs px-2 py-0.5 text-slate-500">+{task.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <div className="flex items-center gap-3">
            <AssigneeAvatars assignees={task.assignees} max={2} />
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {task.comments > 0 && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {task.comments}
                </span>
              )}
              {task.attachments > 0 && (
                <span className="flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  {task.attachments}
                </span>
              )}
            </div>
          </div>
          <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
            <Calendar className="w-3 h-3" />
            {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
