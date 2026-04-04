import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-x-2.5 rounded-sm bg-[#050505] px-2.5 py-1.5 text-xs border-[0.5px]',
  {
    variants: {
      status: {
        success: 'border-emerald-500/20',
        error: 'border-red-500/20',
        default: 'border-white/[0.06]',
      },
    },
    defaultVariants: {
      status: 'default',
    },
  }
);

interface StatusBadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  leftIcon?: React.ComponentType<{ className?: string }>;
  rightIcon?: React.ComponentType<{ className?: string }>;
  leftLabel: string;
  rightLabel: string;
}

export function StatusBadge({
  className,
  status,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  leftLabel,
  rightLabel,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ status }), className)} {...props}>
      <span className="inline-flex items-center gap-1.5 font-medium text-white">
        {LeftIcon && (
          <LeftIcon
            className={cn(
              '-ml-0.5 size-4 shrink-0',
              status === 'success' && 'text-emerald-400',
              status === 'error' && 'text-red-400',
              status === 'default' && 'text-white/60'
            )}
            aria-hidden={true}
          />
        )}
        {leftLabel}
      </span>
      <span className="h-4 w-px bg-white/[0.06]" />
      <span className="inline-flex items-center gap-1.5 text-white/60">
        {RightIcon && (
          <RightIcon className="-ml-0.5 size-4 shrink-0" aria-hidden={true} />
        )}
        {rightLabel}
      </span>
    </span>
  );
}
