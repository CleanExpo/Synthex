'use client';

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/** Ambient canvas behind dashboard pages — restrained depth, not decoration noise. */
export function DashboardAtmosphere({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-orange-500/5 blur-[100px]" />
        <div className="absolute top-40 -right-24 h-64 w-64 rounded-full bg-white/[0.02] blur-[80px]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
            backgroundSize: '28px 28px',
            maskImage: 'linear-gradient(to bottom, black 0%, transparent 85%)',
          }}
        />
      </div>
      {children}
    </div>
  );
}

/** Shared sharp panel used across Mission Control + dashboard home. */
export function DashboardPanel({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        'border-[0.5px] border-white/6 bg-white/[0.015] rounded-sm',
        padded && 'p-5 sm:p-6',
        className
      )}
    >
      {children}
    </div>
  );
}

export function DashboardEyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'text-xs uppercase tracking-[0.22em] text-white/30 mb-1',
        className
      )}
    >
      {children}
    </p>
  );
}
