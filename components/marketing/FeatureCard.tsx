'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LucideIcon, ArrowRight } from 'lucide-react';

/**
 * Feature Card Component
 * Feature showcase with glassmorphism design
 *
 * @task UNI-413 - Implement Marketing Page Components
 */

export interface Feature {
  title: string;
  description: string;
  icon?: LucideIcon;
  iconColor?: string;
  href?: string;
  badge?: string;
  stats?: {
    value: string;
    label: string;
  };
}

export interface FeatureCardProps {
  feature: Feature;
  className?: string;
  variant?: 'default' | 'horizontal' | 'compact' | 'detailed';
  onClick?: () => void;
}

export function FeatureCard({ feature, className, variant = 'default', onClick }: FeatureCardProps) {
  const Icon = feature.icon;
  const isHorizontal = variant === 'horizontal';
  const isCompact = variant === 'compact';
  const isDetailed = variant === 'detailed';

  const content = (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-300 group',
        'glass hover:bg-white/[0.08] hover:border-white/[0.18]',
        onClick && 'cursor-pointer hover:-translate-y-1',
        isHorizontal && 'flex flex-row items-start',
        className
      )}
      onClick={onClick}
    >
      {/* Badge */}
      {feature.badge && (
        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-medium">
          {feature.badge}
        </div>
      )}

      {/* Gradient glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className={cn(
          'absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full blur-3xl',
          feature.iconColor || 'bg-cyan-500/20'
        )} />
      </div>

      <CardHeader className={cn(
        'relative',
        isHorizontal && 'flex-shrink-0 pb-0',
        isCompact && 'pb-2'
      )}>
        {Icon && (
          <div className={cn(
            'flex items-center justify-center rounded-xl transition-transform group-hover:scale-110',
            isCompact ? 'w-10 h-10 mb-2' : 'w-12 h-12 mb-4',
            feature.iconColor
              ? `bg-gradient-to-br ${feature.iconColor}`
              : 'bg-gradient-to-br from-cyan-500/20 to-cyan-500/20 border border-cyan-500/20'
          )}>
            <Icon className={cn(
              'text-white',
              isCompact ? 'w-5 h-5' : 'w-6 h-6'
            )} />
          </div>
        )}
        <h3 className={cn(
          'font-semibold text-white',
          isCompact ? 'text-base' : 'text-lg'
        )}>
          {feature.title}
        </h3>
      </CardHeader>

      <CardContent className={cn(
        'relative',
        isHorizontal && 'pt-6',
        isCompact && 'pt-0'
      )}>
        <p className={cn(
          'text-slate-400 leading-relaxed',
          isCompact ? 'text-sm' : 'text-base'
        )}>
          {feature.description}
        </p>

        {/* Stats */}
        {feature.stats && isDetailed && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-400 bg-clip-text text-transparent">
                {feature.stats.value}
              </span>
              <span className="text-sm text-slate-500">{feature.stats.label}</span>
            </div>
          </div>
        )}

        {/* Arrow link indicator */}
        {feature.href && (
          <div className="mt-4 flex items-center gap-2 text-cyan-400 text-sm font-medium group-hover:gap-3 transition-all">
            Learn more
            <ArrowRight className="w-4 h-4" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (feature.href) {
    return (
      <a href={feature.href} className="block">
        {content}
      </a>
    );
  }

  return content;
}

/**
 * Feature Grid Component
 */
export interface FeatureGridProps {
  features: Feature[];
  columns?: 2 | 3 | 4;
  variant?: FeatureCardProps['variant'];
  className?: string;
}

export function FeatureGrid({ features, columns = 3, variant = 'default', className }: FeatureGridProps) {
  return (
    <div
      className={cn(
        'grid gap-6',
        columns === 2 && 'grid-cols-1 md:grid-cols-2',
        columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
        className
      )}
    >
      {features.map((feature, index) => (
        <FeatureCard key={index} feature={feature} variant={variant} />
      ))}
    </div>
  );
}

/**
 * Feature Section Component
 */
export interface FeatureSectionProps {
  title: string;
  subtitle?: string;
  description?: string;
  features: Feature[];
  columns?: 2 | 3 | 4;
  variant?: FeatureCardProps['variant'];
  className?: string;
}

export function FeatureSection({
  title,
  subtitle,
  description,
  features,
  columns = 3,
  variant = 'default',
  className,
}: FeatureSectionProps) {
  return (
    <section className={cn('py-20', className)}>
      <div className="text-center mb-16">
        {subtitle && (
          <span className="inline-block px-4 py-1.5 mb-4 text-sm font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
            {subtitle}
          </span>
        )}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
          {title}
        </h2>
        {description && (
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            {description}
          </p>
        )}
      </div>

      <FeatureGrid features={features} columns={columns} variant={variant} />
    </section>
  );
}

export default FeatureCard;
