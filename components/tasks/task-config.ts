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
  type LucideIcon,
} from 'lucide-react';
import type { TaskStatus, TaskPriority, TaskType, TeamMember } from './types';

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
  todo: { label: 'To Do', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: Circle },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: Play },
  review: { label: 'In Review', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: Pause },
  done: { label: 'Done', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: CheckCircle },
};

export const priorityConfig: Record<TaskPriority, PriorityConfig> = {
  low: { label: 'Low', color: 'bg-slate-500/20 text-slate-300', icon: ArrowDown },
  medium: { label: 'Medium', color: 'bg-blue-500/20 text-blue-300', icon: ArrowRight },
  high: { label: 'High', color: 'bg-orange-500/20 text-orange-300', icon: ArrowUp },
  urgent: { label: 'Urgent', color: 'bg-red-500/20 text-red-300', icon: AlertCircle },
};

export const typeConfig: Record<TaskType, TypeConfig> = {
  content: { label: 'Content', color: 'bg-cyan-500/20 text-cyan-300', icon: FileText },
  campaign: { label: 'Campaign', color: 'bg-pink-500/20 text-pink-300', icon: Target },
  analytics: { label: 'Analytics', color: 'bg-cyan-500/20 text-cyan-300', icon: TrendingUp },
  social: { label: 'Social', color: 'bg-cyan-500/20 text-cyan-300', icon: MessageSquare },
  design: { label: 'Design', color: 'bg-cyan-500/20 text-cyan-300', icon: Sparkles },
  other: { label: 'Other', color: 'bg-slate-500/20 text-slate-300', icon: ListTodo },
};

export const teamMembers: TeamMember[] = [
  { id: '1', name: 'Sarah Chen', avatar: '/avatars/sarah.jpg', role: 'Content Lead' },
  { id: '2', name: 'Mike Ross', role: 'Social Media Manager' },
  { id: '3', name: 'Alex Kim', role: 'Analytics Specialist' },
  { id: '4', name: 'Emma Wilson', avatar: '/avatars/emma.jpg', role: 'Designer' },
];
