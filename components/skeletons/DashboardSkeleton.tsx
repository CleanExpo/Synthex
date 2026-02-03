/**
 * Dashboard Skeleton Component
 * Loading placeholder for dashboard pages
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-white/10 rounded ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <Card variant="glass">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-1/2 mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-4 w-1/3 mt-2" />
      </CardContent>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="p-4 rounded-lg bg-white/5">
      <Skeleton className="h-4 w-1/2 mb-2" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-3 w-1/3 mt-2" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <Card variant="glass">
      <CardHeader>
        <Skeleton className="h-5 w-1/4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-white/10">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-10 rounded" />
          <Skeleton className="h-10 w-32 rounded" />
        </div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Table Skeleton */}
      <Card variant="glass">
        <CardHeader>
          <Skeleton className="h-5 w-1/4" />
        </CardHeader>
        <CardContent>
          {[...Array(5)].map((_, i) => (
            <TableRowSkeleton key={i} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32 rounded" />
          <Skeleton className="h-10 w-32 rounded" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Main Chart */}
      <ChartSkeleton />

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <ChartSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function TasksSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32 rounded" />
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, col) => (
          <div key={col} className="space-y-4">
            <Skeleton className="h-6 w-24" />
            {[...Array(4)].map((_, card) => (
              <Card key={card} variant="glass" className="p-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default DashboardSkeleton;
