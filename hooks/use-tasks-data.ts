'use client';

/**
 * Custom hook that encapsulates tasks page state, data loading, and handlers.
 * Extracted from app/dashboard/tasks/page.tsx to reduce page file size.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  type Task,
  type TaskStatus,
  type TaskType,
  type TaskPriority,
  statusConfig,
} from '@/components/tasks';

/** Helper to get auth token from storage */
function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || localStorage.getItem('token');
}

/** Map API response to frontend Task format */
function mapApiTaskToTask(t: Record<string, unknown>): Task {
  return {
    id: t.id as string,
    title: t.title as string,
    description: (t.description as string) || '',
    status: ((t.status as string) || 'todo').replace('-', '_') as TaskStatus,
    priority: ((t.priority as string) || 'medium') as TaskPriority,
    type: ((t.category as string) || 'other') as TaskType,
    assignees: t.assigneeId ? [{ id: t.assigneeId as string, name: 'Assigned' }] : [],
    dueDate: t.dueDate ? new Date(t.dueDate as string).toISOString().split('T')[0] : '',
    createdAt: (t.createdAt as string) || new Date().toISOString(),
    updatedAt: (t.updatedAt as string) || new Date().toISOString(),
    tags: (t.tags as string[]) || [],
    subtasks: [],
    comments: 0,
    attachments: 0,
    progress: (t.progress as number) || 0,
    campaignId: t.campaignId as string | undefined,
  };
}

export function useTasksData() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<TaskType | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load tasks on mount
  useEffect(() => {
    const loadTasks = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = getAuthToken();
        const response = await fetch('/api/tasks', {
          credentials: 'include',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });

        if (response.ok) {
          const { data } = await response.json();
          setTasks(data.map(mapApiTaskToTask));
        } else {
          setError('Failed to load tasks');
        }
      } catch {
        setError('Failed to load tasks');
      } finally {
        setIsLoading(false);
      }
    };
    loadTasks();
  }, []);

  const handleRetry = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const token = getAuthToken();
      const response = await fetch('/api/tasks', {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const { data } = await response.json();
        setTasks(data.map(mapApiTaskToTask));
      } else {
        setError('Failed to load tasks');
      }
    } catch {
      setError('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesType = filterType === 'all' || task.type === filterType;
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
      return matchesSearch && matchesStatus && matchesType && matchesPriority;
    });
  }, [tasks, searchQuery, filterStatus, filterType, filterPriority]);

  // Group tasks by status for kanban view
  const tasksByStatus = useMemo(() => ({
    todo: filteredTasks.filter((t) => t.status === 'todo'),
    in_progress: filteredTasks.filter((t) => t.status === 'in_progress'),
    review: filteredTasks.filter((t) => t.status === 'review'),
    done: filteredTasks.filter((t) => t.status === 'done'),
  }), [filteredTasks]);

  // Stats
  const stats = useMemo(() => ({
    total: tasks.length,
    completed: tasks.filter((t) => t.status === 'done').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    overdue: tasks.filter((t) => new Date(t.dueDate) < new Date() && t.status !== 'done').length,
  }), [tasks]);

  // Handlers
  const handleCreateTask = useCallback(async (taskData: Partial<Task>) => {
    const token = getAuthToken();

    const tempId = `temp-${Date.now()}`;
    const newTask: Task = {
      id: tempId,
      title: taskData.title || '',
      description: taskData.description || '',
      status: 'todo',
      priority: taskData.priority || 'medium',
      type: taskData.type || 'content',
      assignees: taskData.assignees || [],
      dueDate: taskData.dueDate || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: taskData.tags || [],
      subtasks: [],
      comments: 0,
      attachments: 0,
      progress: 0,
    };
    setTasks(prev => [newTask, ...prev]);

    if (token) {
      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          credentials: 'include',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: taskData.title,
            description: taskData.description,
            status: 'todo',
            priority: taskData.priority || 'medium',
            category: taskData.type || 'content',
            tags: taskData.tags || [],
            dueDate: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : null,
          }),
        });

        if (response.ok) {
          const { data } = await response.json();
          setTasks(prev => prev.map(t => t.id === tempId ? mapApiTaskToTask(data) : t));
          toast.success('Task created successfully!');
        } else {
          toast.success('Task created locally');
        }
      } catch (err) {
        console.error('Failed to sync task to API:', err);
        toast.success('Task created locally');
      }
    } else {
      toast.success('Task created successfully!');
    }
  }, []);

  const handleEditTask = useCallback((task: Task) => {
    toast.success('Edit dialog would open here');
  }, []);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    const token = getAuthToken();
    setTasks(prev => prev.filter((t) => t.id !== taskId));

    if (token && !taskId.startsWith('temp-') && !taskId.startsWith('task-')) {
      try {
        const response = await fetch(`/api/tasks?id=${taskId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });

        if (response.ok) {
          toast.success('Task deleted');
        } else {
          toast.success('Task deleted locally');
        }
      } catch (err) {
        console.error('Failed to delete task from API:', err);
        toast.success('Task deleted locally');
      }
    } else {
      toast.success('Task deleted');
    }
  }, []);

  const handleStatusChange = useCallback(async (taskId: string, status: TaskStatus) => {
    const token = getAuthToken();

    setTasks(prev => prev.map((t) =>
      t.id === taskId ? { ...t, status, updatedAt: new Date().toISOString() } : t
    ));

    if (token && !taskId.startsWith('temp-') && !taskId.startsWith('task-')) {
      try {
        const apiStatus = status.replace('_', '-');
        const response = await fetch('/api/tasks', {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: taskId, status: apiStatus }),
        });

        if (response.ok) {
          toast.success(`Task moved to ${statusConfig[status].label}`);
        } else {
          toast.success(`Task moved to ${statusConfig[status].label} (locally)`);
        }
      } catch (err) {
        console.error('Failed to update task status:', err);
        toast.success(`Task moved to ${statusConfig[status].label} (locally)`);
      }
    } else {
      toast.success(`Task moved to ${statusConfig[status].label}`);
    }
  }, []);

  return {
    // State
    tasks,
    view,
    setView,
    searchQuery,
    setSearchQuery,
    filterStatus,
    setFilterStatus,
    filterType,
    setFilterType,
    filterPriority,
    setFilterPriority,
    createDialogOpen,
    setCreateDialogOpen,
    isLoading,
    error,
    filteredTasks,
    tasksByStatus,
    stats,

    // Handlers
    handleRetry,
    handleCreateTask,
    handleEditTask,
    handleDeleteTask,
    handleStatusChange,
  };
}
