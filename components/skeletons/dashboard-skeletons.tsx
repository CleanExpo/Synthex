/**
 * Dashboard Loading Skeletons
 *
 * @description Consistent loading states for dashboard components:
 * - Stats cards
 * - Charts
 * - Activity feeds
 * - Tasks lists
 * - Tables
 */

'use client';

import React from 'react';

// ============================================================================
// BASE SKELETON
// ============================================================================

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full' | 'none';
  animate?: boolean;
}

export function Skeleton({
  className = '',
  width,
  height,
  rounded = 'md',
  animate = true,
}: SkeletonProps) {
  const roundedClasses = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
    none: 'rounded-none',
  };

  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700 ${roundedClasses[rounded]} ${
        animate ? 'animate-pulse' : ''
      } ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
}

// ============================================================================
// STATS CARD SKELETON
// ============================================================================

export function StatsCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <Skeleton width={120} height={16} />
        <Skeleton width={32} height={32} rounded="full" />
      </div>
      <Skeleton width={80} height={32} className="mb-2" />
      <div className="flex items-center gap-2">
        <Skeleton width={60} height={16} />
        <Skeleton width={80} height={16} />
      </div>
    </div>
  );
}

export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatsCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ============================================================================
// CHART SKELETON
// ============================================================================

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <Skeleton width={150} height={24} />
        <div className="flex gap-2">
          <Skeleton width={60} height={32} />
          <Skeleton width={60} height={32} />
          <Skeleton width={60} height={32} />
        </div>
      </div>
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 flex items-end justify-between gap-2 px-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              width="100%"
              height={`${20 + Math.random() * 60}%`}
              className="flex-1"
            />
          ))}
        </div>
      </div>
      <div className="flex justify-center gap-4 mt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton width={12} height={12} rounded="full" />
            <Skeleton width={60} height={14} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PieChartSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <Skeleton width={150} height={24} className="mb-6" />
      <div className="flex items-center justify-center">
        <Skeleton width={200} height={200} rounded="full" />
      </div>
      <div className="flex flex-wrap justify-center gap-4 mt-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton width={12} height={12} rounded="full" />
            <Skeleton width={70} height={14} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// ACTIVITY FEED SKELETON
// ============================================================================

export function ActivityItemSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3">
      <Skeleton width={40} height={40} rounded="full" />
      <div className="flex-1 min-w-0">
        <Skeleton width="70%" height={16} className="mb-2" />
        <Skeleton width="40%" height={14} />
      </div>
      <Skeleton width={60} height={14} />
    </div>
  );
}

export function ActivityFeedSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <Skeleton width={120} height={20} />
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {Array.from({ length: count }).map((_, i) => (
          <ActivityItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// TASK SKELETON
// ============================================================================

export function TaskCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-start justify-between mb-3">
        <Skeleton width="60%" height={18} />
        <Skeleton width={24} height={24} rounded="full" />
      </div>
      <Skeleton width="90%" height={14} className="mb-3" />
      <div className="flex items-center gap-2 mb-3">
        <Skeleton width={60} height={20} rounded="full" />
        <Skeleton width={50} height={20} rounded="full" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton width={28} height={28} rounded="full" />
        <Skeleton width={80} height={14} />
      </div>
    </div>
  );
}

export function TasksListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <TaskCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function KanbanColumnSkeleton({ taskCount = 3 }: { taskCount?: number }) {
  return (
    <div className="flex-shrink-0 w-72 bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skeleton width={100} height={18} />
          <Skeleton width={24} height={24} rounded="full" />
        </div>
        <Skeleton width={24} height={24} />
      </div>
      <div className="space-y-3">
        {Array.from({ length: taskCount }).map((_, i) => (
          <TaskCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      <KanbanColumnSkeleton taskCount={3} />
      <KanbanColumnSkeleton taskCount={2} />
      <KanbanColumnSkeleton taskCount={4} />
      <KanbanColumnSkeleton taskCount={1} />
    </div>
  );
}

// ============================================================================
// TABLE SKELETON
// ============================================================================

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-700">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton
            width={i === 0 ? '80%' : i === columns - 1 ? 60 : '60%'}
            height={16}
          />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <Skeleton width={80} height={14} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// PLATFORM METRICS SKELETON
// ============================================================================

export function PlatformCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton width={40} height={40} rounded="lg" />
        <div>
          <Skeleton width={80} height={16} className="mb-1" />
          <Skeleton width={60} height={14} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Skeleton width={60} height={12} className="mb-1" />
          <Skeleton width={80} height={20} />
        </div>
        <div>
          <Skeleton width={60} height={12} className="mb-1" />
          <Skeleton width={80} height={20} />
        </div>
      </div>
    </div>
  );
}

export function PlatformGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <PlatformCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ============================================================================
// FULL DASHBOARD SKELETON
// ============================================================================

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton width={200} height={28} className="mb-2" />
          <Skeleton width={300} height={16} />
        </div>
        <div className="flex gap-2">
          <Skeleton width={100} height={40} />
          <Skeleton width={120} height={40} />
        </div>
      </div>

      {/* Stats */}
      <StatsGridSkeleton count={4} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <PieChartSkeleton />
      </div>

      {/* Activity and Trending */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeedSkeleton count={5} />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <Skeleton width={120} height={20} className="mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton width="60%" height={16} />
                <Skeleton width={50} height={16} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ANALYTICS SKELETON
// ============================================================================

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton width={150} height={28} />
        <div className="flex gap-2">
          <Skeleton width={80} height={36} />
          <Skeleton width={80} height={36} />
          <Skeleton width={80} height={36} />
          <Skeleton width={80} height={36} />
        </div>
      </div>

      {/* Stats */}
      <StatsGridSkeleton count={6} />

      {/* Main Chart */}
      <ChartSkeleton height={400} />

      {/* Platform Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PieChartSkeleton />
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <Skeleton width={120} height={24} className="mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton width={40} height={40} rounded="lg" />
                <div className="flex-1">
                  <Skeleton width="40%" height={16} className="mb-1" />
                  <Skeleton width="100%" height={8} rounded="full" />
                </div>
                <Skeleton width={60} height={20} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Posts */}
      <TableSkeleton rows={5} columns={5} />
    </div>
  );
}

// ============================================================================
// CONTENT SKELETON
// ============================================================================

export function ContentCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Skeleton width={24} height={24} rounded="full" />
          <Skeleton width={80} height={16} />
        </div>
        <Skeleton width={60} height={24} rounded="full" />
      </div>
      <Skeleton width="100%" height={60} className="mb-3" />
      <Skeleton width="80%" height={14} className="mb-2" />
      <Skeleton width="50%" height={14} />
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex gap-3">
          <Skeleton width={40} height={14} />
          <Skeleton width={40} height={14} />
          <Skeleton width={40} height={14} />
        </div>
        <Skeleton width={24} height={24} />
      </div>
    </div>
  );
}

export function ContentGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ContentCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Skeleton;
