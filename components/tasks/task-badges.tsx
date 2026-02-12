'use client';

/**
 * Task Badge Components
 * Reusable badges for task status, priority, type, and assignees
 */

import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { statusConfig, priorityConfig, typeConfig } from './task-config';
import type { TaskStatus, TaskPriority, TaskType, TaskAssignee } from './types';

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`${config.color} border`}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = priorityConfig[priority];
  const Icon = config.icon;
  return (
    <Badge className={config.color}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export function TaskTypeBadge({ type }: { type: TaskType }) {
  const config = typeConfig[type];
  const Icon = config.icon;
  return (
    <Badge className={config.color}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export function AssigneeAvatars({
  assignees,
  max = 3
}: {
  assignees: TaskAssignee[];
  max?: number;
}) {
  const visible = assignees.slice(0, max);
  const overflow = assignees.length - max;

  return (
    <div className="flex -space-x-2">
      {visible.map((assignee) => (
        <Avatar key={assignee.id} className="w-7 h-7 border-2 border-slate-900">
          <AvatarImage src={assignee.avatar} alt={assignee.name} />
          <AvatarFallback className="text-xs bg-cyan-500/20 text-cyan-300">
            {assignee.name.split(' ').map((n) => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <div className="w-7 h-7 rounded-full bg-white/10 border-2 border-slate-900 flex items-center justify-center text-xs text-slate-400">
          +{overflow}
        </div>
      )}
    </div>
  );
}
