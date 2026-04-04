'use client';

import { cn } from '@/lib/utils';
import type { ComponentType, SVGProps } from 'react';

type IconComponent = ComponentType<
  SVGProps<SVGSVGElement> & { className?: string }
>;

interface DashboardEmptyStateProps {
  icon: IconComponent;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: IconComponent;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/** Empty state — Scientific Luxury: no rounded cards, sharp containers */
export function DashboardEmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: DashboardEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-20 px-8 text-center',
        'border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm',
        className
      )}
    >
      {/* Icon container */}
      <div className="mb-6 w-14 h-14 flex items-center justify-center border-[0.5px] border-white/[0.1] bg-white/[0.02] rounded-sm">
        <Icon className="h-6 w-6 text-orange-400/70" />
      </div>

      {/* Content */}
      <h3 className="text-lg font-light text-white tracking-tight mb-2">
        {title}
      </h3>
      <p className="text-sm text-white/40 max-w-sm leading-relaxed mb-8">
        {description}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {action && (
          <button
            onClick={action.onClick}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-[#050505] text-xs font-semibold tracking-wide rounded-sm transition-colors"
          >
            {action.icon && <action.icon className="h-3.5 w-3.5" />}
            {action.label}
          </button>
        )}
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="flex items-center gap-2 px-5 py-2.5 border-[0.5px] border-white/[0.1] text-white/50 hover:text-white hover:border-white/20 text-xs tracking-wide rounded-sm transition-colors bg-white/[0.02]"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}
