'use client';

/**
 * Task Stats Component
 * Displays task statistics in a grid of cards
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListTodo, Play, CheckCircle, AlertCircle } from '@/components/icons';

interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
}

export function TaskStatsGrid({ stats }: { stats: TaskStats }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Total Tasks</CardTitle>
          <ListTodo className="h-4 w-4 text-cyan-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <p className="text-xs text-slate-500 mt-1">Active tasks</p>
        </CardContent>
      </Card>
      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">In Progress</CardTitle>
          <Play className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{stats.inProgress}</div>
          <p className="text-xs text-slate-500 mt-1">Currently working on</p>
        </CardContent>
      </Card>
      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Completed</CardTitle>
          <CheckCircle className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{stats.completed}</div>
          <p className="text-xs text-slate-500 mt-1">
            {stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(0) : 0}% completion rate
          </p>
        </CardContent>
      </Card>
      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Overdue</CardTitle>
          <AlertCircle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{stats.overdue}</div>
          <p className="text-xs text-slate-500 mt-1">Need attention</p>
        </CardContent>
      </Card>
    </div>
  );
}
