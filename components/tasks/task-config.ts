/**
 * Task Configuration
 * Status, priority, and type configurations with colors and icons
 */

import {
  Circle,
  Play,
  Pause,
  CheckCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  AlertCircle,
  FileText,
  Target,
  TrendingUp,
  MessageSquare,
  Sparkles,
  ListTodo,
} from '@/components/icons';
import type { ComponentType, SVGProps } from 'react';

type LucideIcon = ComponentType<
  SVGProps<SVGSVGElement> & { className?: string }
>;
import type { TaskStatus, TaskPriority, TaskType } from './types';
import {
  getAgencyTask,
  listAgencyTasks,
  CEO_TOP_15_IDS,
  type AgencyTaskDefinition,
} from '@/lib/agency/agency-task-catalog';

export { listAgencyTasks, getAgencyTask, CEO_TOP_15_IDS };
export type { AgencyTaskDefinition };

export interface StatusConfig {
  label: string;
  color: string;
  icon: LucideIcon;
}

export interface PriorityConfig {
  label: string;
  color: string;
  icon: LucideIcon;
}

export interface TypeConfig {
  label: string;
  color: string;
  icon: LucideIcon;
}

export const statusConfig: Record<TaskStatus, StatusConfig> = {
  todo: {
    label: 'To Do',
    color: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    icon: Circle,
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: Play,
  },
  review: {
    label: 'In Review',
    color: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    icon: Pause,
  },
  done: {
    label: 'Done',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    icon: CheckCircle,
  },
};

export const priorityConfig: Record<TaskPriority, PriorityConfig> = {
  low: {
    label: 'Low',
    color: 'bg-slate-500/20 text-slate-300',
    icon: ArrowDown,
  },
  medium: {
    label: 'Medium',
    color: 'bg-blue-500/20 text-blue-300',
    icon: ArrowRight,
  },
  high: {
    label: 'High',
    color: 'bg-orange-500/20 text-orange-300',
    icon: ArrowUp,
  },
  urgent: {
    label: 'Urgent',
    color: 'bg-red-500/20 text-red-300',
    icon: AlertCircle,
  },
};

export const typeConfig: Record<TaskType, TypeConfig> = {
  content: {
    label: 'Content',
    color: 'bg-orange-500/20 text-orange-300',
    icon: FileText,
  },
  campaign: {
    label: 'Campaign',
    color: 'bg-orange-500/20 text-orange-300',
    icon: Target,
  },
  analytics: {
    label: 'Analytics',
    color: 'bg-orange-500/20 text-orange-300',
    icon: TrendingUp,
  },
  social: {
    label: 'Social',
    color: 'bg-orange-500/20 text-orange-300',
    icon: MessageSquare,
  },
  design: {
    label: 'Design',
    color: 'bg-orange-500/20 text-orange-300',
    icon: Sparkles,
  },
  other: {
    label: 'Other',
    color: 'bg-slate-500/20 text-slate-300',
    icon: ListTodo,
  },
};

// Assignees come from GET /api/team, which is organisation-scoped. There is no
// static team list here: the four names that used to live at this line were
// fictional and were being offered as real assignees on the live task board.
