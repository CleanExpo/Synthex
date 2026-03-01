'use client';

/**
 * Tasks Management Page
 * Full-featured task management for marketing workflows
 *
 * @task UNI-415 - Tasks Management Full UI
 */

import { Button } from '@/components/ui/button';
import { TasksSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import { Plus, Filter, ListTodo } from '@/components/icons';
import {
  KanbanColumn,
  TaskListRow,
  CreateTaskDialog,
  TaskStatsGrid,
  TaskToolbar,
} from '@/components/tasks';
import { useTasksData } from '@/hooks/use-tasks-data';

export default function TasksPage() {
  const {
    tasks,
    view,
    setView,
    searchQuery,
    setSearchQuery,
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
    handleRetry,
    handleCreateTask,
    handleEditTask,
    handleDeleteTask,
    handleStatusChange,
  } = useTasksData();

  if (isLoading) {
    return <TasksSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6">
        <APIErrorCard title="Tasks Error" message={error} onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Tasks</h1>
          <p className="text-slate-400 mt-1">
            Manage your marketing tasks and workflows
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <Button variant="outline" className="bg-white/5 border-white/10">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)} className="gradient-primary">
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Stats */}
      <TaskStatsGrid stats={stats} />

      {/* Toolbar */}
      <TaskToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        filterPriority={filterPriority}
        onFilterPriorityChange={setFilterPriority}
        view={view}
        onViewChange={setView}
      />

      {/* Task Views */}
      {tasks.length === 0 ? (
        <div className="text-center py-12">
          <ListTodo className="h-16 w-16 mx-auto mb-4 text-slate-500" />
          <h3 className="text-xl font-semibold text-white mb-2">No tasks yet</h3>
          <p className="text-slate-400 mb-4">Create your first task to get started.</p>
          <Button onClick={() => setCreateDialogOpen(true)} className="gradient-primary">
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>
      ) : view === 'kanban' ? (
        <div className="flex gap-6 overflow-x-auto pb-4">
          {(['todo', 'in_progress', 'review', 'done'] as const).map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              onEdit={handleEditTask}
              onDelete={handleDeleteTask}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <ListTodo className="h-16 w-16 mx-auto mb-4 text-slate-500" />
              <h3 className="text-xl font-semibold text-white mb-2">No Tasks Found</h3>
              <p className="text-slate-400">
                {searchQuery ? 'Try adjusting your search or filters' : 'Create your first task to get started'}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <TaskListRow
                key={task.id}
                task={task}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                onStatusChange={handleStatusChange}
              />
            ))
          )}
        </div>
      )}

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateTask}
      />
    </div>
  );
}
