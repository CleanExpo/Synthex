'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

/**
 * Stat Card Component
 * Statistics display with glassmorphism design
 *
 * @task UNI-413 - Implement Marketing Page Components
 */

export interface Stat {
  value: string | number;
  label: string;
  description?: string;
  change?: {
    value: number;
    period?: string;
  };
  icon?: LucideIcon;
  iconColor?: string;
  suffix?: string;
  prefix?: string;
}

export interface StatCardProps {
  stat: Stat;
  className?: string;
  variant?: 'default' | 'compact' | 'large' | 'minimal';
  animated?: boolean;
}

export function StatCard({ stat, className, variant = 'default', animated = true }: StatCardProps) {
  const Icon = stat.icon;
  const isCompact = variant === 'compact';
  const isLarge = variant === 'large';
  const isMinimal = variant === 'minimal';

  const changeDirection = stat.change
    ? stat.change.value > 0
      ? 'up'
      : stat.change.value < 0
        ? 'down'
        : 'neutral'
    : null;

  const ChangeIcon = changeDirection === 'up'
    ? TrendingUp
    : changeDirection === 'down'
      ? TrendingDown
      : Minus;

  if (isMinimal) {
    return (
      <div className={cn('text-center', className)}>
        <div className={cn(
          'text-4xl md:text-5xl font-bold mb-1',
          animated && 'animate-in fade-in slide-in-from-bottom-4 duration-700',
          'bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent'
        )}>
          {stat.prefix}{stat.value}{stat.suffix}
        </div>
        <div className="text-slate-400 text-sm">{stat.label}</div>
      </div>
    );
  }

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-300',
        'glass hover:bg-white/[0.08]',
        isLarge && 'text-center',
        className
      )}
    >
      {/* Background glow */}
      {Icon && (
        <div className={cn(
          'absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20',
          stat.iconColor || 'bg-cyan-500'
        )} />
      )}

      <CardContent className={cn(
        'relative',
        isCompact ? 'p-4' : isLarge ? 'p-8' : 'p-6'
      )}>
        <div className={cn(
          'flex',
          isLarge ? 'flex-col items-center' : 'items-start justify-between'
        )}>
          {/* Main content */}
          <div className={isLarge ? 'mb-4' : ''}>
            <div className={cn(
              'font-bold',
              animated && 'animate-in fade-in slide-in-from-left-4 duration-500',
              isCompact ? 'text-2xl' : isLarge ? 'text-5xl md:text-6xl' : 'text-3xl',
              'bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent'
            )}>
              {stat.prefix}{stat.value}{stat.suffix}
            </div>
            <div className={cn(
              'text-slate-400 mt-1',
              isCompact ? 'text-xs' : isLarge ? 'text-lg' : 'text-sm'
            )}>
              {stat.label}
            </div>
            {stat.description && (
              <p className="text-slate-500 text-sm mt-2">{stat.description}</p>
            )}
          </div>

          {/* Icon */}
          {Icon && !isLarge && (
            <div className={cn(
              'flex items-center justify-center rounded-xl',
              isCompact ? 'w-10 h-10' : 'w-12 h-12',
              stat.iconColor
                ? `bg-gradient-to-br ${stat.iconColor}`
                : 'bg-gradient-to-br from-cyan-500/20 to-cyan-500/20 border border-cyan-500/20'
            )}>
              <Icon className={cn(
                'text-white',
                isCompact ? 'w-5 h-5' : 'w-6 h-6'
              )} />
            </div>
          )}

          {Icon && isLarge && (
            <div className={cn(
              'w-16 h-16 flex items-center justify-center rounded-2xl mb-4',
              stat.iconColor
                ? `bg-gradient-to-br ${stat.iconColor}`
                : 'bg-gradient-to-br from-cyan-500/20 to-cyan-500/20 border border-cyan-500/20'
            )}>
              <Icon className="w-8 h-8 text-white" />
            </div>
          )}
        </div>

        {/* Change indicator */}
        {stat.change && (
          <div className={cn(
            'flex items-center gap-1 mt-3',
            isLarge && 'justify-center'
          )}>
            <div className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              changeDirection === 'up' && 'bg-emerald-500/10 text-emerald-400',
              changeDirection === 'down' && 'bg-red-500/10 text-red-400',
              changeDirection === 'neutral' && 'bg-slate-500/10 text-slate-400'
            )}>
              <ChangeIcon className="w-3 h-3" />
              <span>{Math.abs(stat.change.value)}%</span>
            </div>
            {stat.change.period && (
              <span className="text-xs text-slate-500">{stat.change.period}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Stats Grid Component
 */
export interface StatsGridProps {
  stats: Stat[];
  columns?: 2 | 3 | 4;
  variant?: StatCardProps['variant'];
  className?: string;
}

export function StatsGrid({ stats, columns = 4, variant = 'default', className }: StatsGridProps) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 2 && 'grid-cols-1 md:grid-cols-2',
        columns === 3 && 'grid-cols-1 md:grid-cols-3',
        columns === 4 && 'grid-cols-2 md:grid-cols-4',
        className
      )}
    >
      {stats.map((stat, index) => (
        <StatCard
          key={index}
          stat={stat}
          variant={variant}
          className={`animate-delay-${index * 100}`}
        />
      ))}
    </div>
  );
}

/**
 * Stats Banner Component
 */
export interface StatsBannerProps {
  stats: Stat[];
  className?: string;
}

export function StatsBanner({ stats, className }: StatsBannerProps) {
  return (
    <div className={cn(
      'glass rounded-2xl p-8 md:p-12',
      className
    )}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
        {stats.map((stat, index) => (
          <StatCard key={index} stat={stat} variant="minimal" />
        ))}
      </div>
    </div>
  );
}

export default StatCard;
