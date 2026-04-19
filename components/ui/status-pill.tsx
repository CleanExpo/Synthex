import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * StatusPill — unified status chip component.
 *
 * Replaces the scattered use of badge.tsx status-active/inactive/pending/error
 * variants and hand-rolled status spans across the codebase.
 *
 * Usage:
 *   <StatusPill status="active">Live</StatusPill>
 *   <StatusPill status="pending" dot={false}>Scheduled</StatusPill>
 */

const statusPillVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-none',
  {
    variants: {
      status: {
        active:
          'bg-emerald-500/15 border-emerald-500/25 text-emerald-300',
        inactive:
          'bg-slate-500/15 border-slate-500/25 text-slate-400',
        pending:
          'bg-orange-500/15 border-orange-500/25 text-orange-300',
        error:
          'bg-red-500/15 border-red-500/25 text-red-300',
        // Neutral — no semantic colour, just structural
        neutral:
          'bg-white/[0.06] border-white/[0.1] text-white/60',
      },
      size: {
        sm: 'px-2 py-0.5 text-[10px]',
        default: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      status: 'neutral',
      size: 'default',
    },
  }
);

const dotColour: Record<NonNullable<StatusPillProps['status']>, string> = {
  active: 'bg-emerald-400',
  inactive: 'bg-slate-400',
  pending: 'bg-orange-400',
  error: 'bg-red-400',
  neutral: 'bg-white/40',
};

const dotPulse: Record<NonNullable<StatusPillProps['status']>, boolean> = {
  active: true,
  inactive: false,
  pending: true,
  error: false,
  neutral: false,
};

export interface StatusPillProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {
  /** Show the status dot indicator (default: true) */
  dot?: boolean;
}

const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ className, status, size, dot = true, children, ...props }, ref) => {
    const resolvedStatus = status ?? 'neutral';
    const shouldPulse = dotPulse[resolvedStatus];

    return (
      <span
        ref={ref}
        className={cn(statusPillVariants({ status, size }), className)}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              'inline-block w-1.5 h-1.5 rounded-full flex-shrink-0',
              dotColour[resolvedStatus],
              shouldPulse && 'animate-pulse'
            )}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    );
  }
);
StatusPill.displayName = 'StatusPill';

export { StatusPill, statusPillVariants };
