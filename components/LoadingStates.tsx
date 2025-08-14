'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  className?: string;
}

export function LoadingSpinner({ size = 'md', text, className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return (
    <div className={cn('flex flex-col items-center justify-center space-y-3', className)}>
      <Loader2 className={cn(sizeClasses[size], 'animate-spin text-cyan-400')} />
      {text && (
        <p className="text-sm text-gray-400 animate-pulse">{text}</p>
      )}
    </div>
  );
}

interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message = 'Loading...' }: PageLoadingProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-cyan-900/20 to-gray-900">
      <div className="text-center space-y-4">
        <div className="relative">
          <Sparkles className="w-16 h-16 text-cyan-400 animate-pulse mx-auto" />
          <Loader2 className="w-8 h-8 animate-spin text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <h2 className="text-2xl font-semibold text-white">{message}</h2>
        <p className="text-gray-400">Please wait while we prepare your content</p>
      </div>
    </div>
  );
}

interface SkeletonProps {
  className?: string;
  lines?: number;
  showAvatar?: boolean;
  showTitle?: boolean;
}

export function Skeleton({ className, lines = 3, showAvatar = false, showTitle = true }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse space-y-3', className)}>
      {showAvatar && (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-700 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-700 rounded w-1/3" />
            <div className="h-3 bg-gray-700 rounded w-1/4" />
          </div>
        </div>
      )}
      
      {showTitle && (
        <div className="h-6 bg-gray-700 rounded w-2/3 mb-4" />
      )}
      
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-700 rounded" style={{
            width: `${100 - (i * 10)}%`
          }} />
        ))}
      </div>
    </div>
  );
}

interface CardSkeletonProps {
  count?: number;
  className?: string;
}

export function CardSkeleton({ count = 1, className }: CardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn('liquid-glass p-6 animate-pulse', className)}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-6 bg-gray-700 rounded w-1/3" />
              <div className="h-6 bg-gray-700 rounded-full w-20" />
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-700 rounded w-full" />
              <div className="h-4 bg-gray-700 rounded w-5/6" />
              <div className="h-4 bg-gray-700 rounded w-4/6" />
            </div>
            <div className="flex space-x-2 pt-3">
              <div className="h-10 bg-gray-700 rounded flex-1" />
              <div className="h-10 bg-gray-700 rounded flex-1" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, columns = 4, className }: TableSkeletonProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="liquid-glass rounded-lg overflow-hidden">
        {/* Header */}
        <div className="border-b border-white/10 p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        </div>
        
        {/* Rows */}
        <div className="divide-y divide-white/5">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="p-4">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <div 
                    key={colIndex} 
                    className="h-4 bg-gray-700 rounded animate-pulse"
                    style={{ animationDelay: `${(rowIndex + colIndex) * 100}ms` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-1/4 mb-2" />
        <div className="h-4 bg-gray-700 rounded w-1/3" />
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <CardSkeleton count={4} />
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="liquid-glass p-6 animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4" />
          <div className="h-64 bg-gray-700/50 rounded" />
        </div>
        <div className="liquid-glass p-6 animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4" />
          <div className="h-64 bg-gray-700/50 rounded" />
        </div>
      </div>
      
      {/* Table */}
      <TableSkeleton />
    </div>
  );
}