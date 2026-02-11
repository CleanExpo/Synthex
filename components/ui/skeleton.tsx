import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const skeletonVariants = cva('animate-pulse rounded-md', {
  variants: {
    variant: {
      default: 'bg-muted',
      // Premium Glassmorphism variants
      glass: 'bg-white/10 backdrop-blur-sm',
      'glass-solid': 'bg-slate-700/50 backdrop-blur-sm',
      'glass-primary': 'bg-cyan-500/20 backdrop-blur-sm',
      'glass-secondary': 'bg-cyan-500/20 backdrop-blur-sm',
      'glass-success': 'bg-emerald-500/20 backdrop-blur-sm',
      // Shimmer variants with gradient animation
      shimmer:
        'bg-gradient-to-r from-white/5 via-white/15 to-white/5 bg-[length:200%_100%] animate-shimmer',
      'shimmer-primary':
        'bg-gradient-to-r from-cyan-500/10 via-cyan-500/25 to-cyan-500/10 bg-[length:200%_100%] animate-shimmer',
      'shimmer-secondary':
        'bg-gradient-to-r from-cyan-500/10 via-cyan-500/25 to-cyan-500/10 bg-[length:200%_100%] animate-shimmer',
    },
  },
  defaultVariants: {
    variant: 'glass',
  },
});

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

function Skeleton({ className, variant, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(skeletonVariants({ variant, className }))}
      role="status"
      aria-busy="true"
      aria-label="Loading"
      {...props}
    />
  );
}

function SkeletonCard({ variant = 'glass' }: { variant?: SkeletonProps['variant'] }) {
  return (
    <div
      className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-lg p-6 space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Loading card content"
    >
      <span className="sr-only">Loading card content...</span>
      <div className="flex items-center justify-between">
        <Skeleton variant={variant} className="h-4 w-24" aria-hidden="true" />
        <Skeleton variant={variant} className="h-8 w-8 rounded-full" aria-hidden="true" />
      </div>
      <Skeleton variant={variant} className="h-8 w-32" aria-hidden="true" />
      <Skeleton variant={variant} className="h-3 w-full" aria-hidden="true" />
      <div className="flex gap-2">
        <Skeleton variant={variant} className="h-3 w-16" aria-hidden="true" />
        <Skeleton variant={variant} className="h-3 w-20" aria-hidden="true" />
      </div>
    </div>
  );
}

function SkeletonChart({ variant = 'glass' }: { variant?: SkeletonProps['variant'] }) {
  return (
    <div
      className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-lg p-6"
      role="status"
      aria-busy="true"
      aria-label="Loading chart"
    >
      <span className="sr-only">Loading chart data...</span>
      <div className="space-y-2 mb-4">
        <Skeleton variant={variant} className="h-5 w-32" aria-hidden="true" />
        <Skeleton variant={variant} className="h-3 w-48" aria-hidden="true" />
      </div>
      <div className="h-64 flex items-end justify-between gap-2">
        {[...Array(7)].map((_, i) => (
          <Skeleton
            key={i}
            variant={variant}
            className="flex-1"
            style={{ height: `${Math.random() * 80 + 20}%` }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}

function SkeletonTable({ variant = 'glass' }: { variant?: SkeletonProps['variant'] }) {
  return (
    <div
      className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-lg p-6"
      role="status"
      aria-busy="true"
      aria-label="Loading table"
    >
      <span className="sr-only">Loading table data...</span>
      <Skeleton variant={variant} className="h-5 w-32 mb-4" aria-hidden="true" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton variant={variant} className="h-10 w-10 rounded-full" aria-hidden="true" />
            <div className="flex-1 space-y-2">
              <Skeleton variant={variant} className="h-3 w-24" aria-hidden="true" />
              <Skeleton variant={variant} className="h-2 w-full" aria-hidden="true" />
            </div>
            <Skeleton variant={variant} className="h-4 w-16" aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonText({
  lines = 3,
  variant = 'glass',
}: {
  lines?: number;
  variant?: SkeletonProps['variant'];
}) {
  return (
    <div className="space-y-2">
      {[...Array(lines)].map((_, i) => (
        <Skeleton
          key={i}
          variant={variant}
          className="h-3"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

function SkeletonAvatar({
  size = 'default',
  variant = 'glass',
}: {
  size?: 'sm' | 'default' | 'lg' | 'xl';
  variant?: SkeletonProps['variant'];
}) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    default: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  return <Skeleton variant={variant} className={cn('rounded-full', sizeClasses[size])} />;
}

export {
  Skeleton,
  SkeletonCard,
  SkeletonChart,
  SkeletonTable,
  SkeletonText,
  SkeletonAvatar,
  skeletonVariants,
};
