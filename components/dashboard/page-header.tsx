'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}

/** Universal dashboard page header — Scientific Luxury: extralight, sharp, consistent */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          {eyebrow && (
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-2 block">
              {eyebrow}
            </span>
          )}
          <h1 className="text-2xl sm:text-3xl font-extralight tracking-tight text-white">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-white/40 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
        )}
      </div>
      <div className="mt-5 h-px bg-white/[0.06]" />
    </div>
  );
}
