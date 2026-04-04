/**
 * Task Management Types
 * Shared type definitions for the tasks feature
 */

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: 'content' | 'campaign' | 'analytics' | 'social' | 'design' | 'other';
  assignees: TaskAssignee[];
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  subtasks: TaskSubtask[];
  comments: number;
  attachments: number;
  progress: number;
  campaignId?: string;
  campaignName?: string;
}

export interface TaskAssignee {
  id: string;
  name: string;
  avatar?: string;
}

export interface TaskSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  role: string;
}

export type TaskStatus = Task['status'];
export type TaskPriority = Task['priority'];
export type TaskType = Task['type'];
