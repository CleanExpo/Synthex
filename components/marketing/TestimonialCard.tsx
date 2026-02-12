'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Star, Quote } from '@/components/icons';

/**
 * Testimonial Card Component
 * Customer testimonials with glassmorphism design
 *
 * @task UNI-413 - Implement Marketing Page Components
 */

export interface Testimonial {
  quote: string;
  author: {
    name: string;
    title: string;
    company?: string;
    avatar?: string;
  };
  rating?: number;
  featured?: boolean;
  platform?: string;
  metrics?: {
    label: string;
    value: string;
  };
}

export interface TestimonialCardProps {
  testimonial: Testimonial;
  className?: string;
  variant?: 'default' | 'featured' | 'compact';
}

export function TestimonialCard({ testimonial, className, variant = 'default' }: TestimonialCardProps) {
  const isFeatured = variant === 'featured' || testimonial.featured;
  const isCompact = variant === 'compact';

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-300',
        isFeatured
          ? 'glass-primary'
          : 'glass hover:bg-white/[0.08]',
        isCompact ? 'p-4' : '',
        className
      )}
    >
      {/* Quote icon */}
      <div className={cn(
        'absolute opacity-10',
        isFeatured ? 'text-cyan-400' : 'text-white',
        isCompact ? 'top-2 right-2' : 'top-4 right-4'
      )}>
        <Quote className={isCompact ? 'w-8 h-8' : 'w-12 h-12'} />
      </div>

      <CardContent className={cn('relative', isCompact ? 'p-0' : 'pt-6')}>
        {/* Rating */}
        {testimonial.rating && (
          <div className="flex gap-1 mb-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  'w-4 h-4',
                  i < testimonial.rating!
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-600'
                )}
              />
            ))}
          </div>
        )}

        {/* Quote */}
        <blockquote className={cn(
          'text-slate-300 leading-relaxed mb-4',
          isCompact ? 'text-sm' : 'text-base',
          isFeatured ? 'text-slate-200' : ''
        )}>
          "{testimonial.quote}"
        </blockquote>

        {/* Metrics */}
        {testimonial.metrics && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <span className="text-emerald-400 font-semibold text-sm">
              {testimonial.metrics.value}
            </span>
            <span className="text-slate-400 text-xs">
              {testimonial.metrics.label}
            </span>
          </div>
        )}

        {/* Author */}
        <div className="flex items-center gap-3">
          {testimonial.author.avatar ? (
            <img
              src={testimonial.author.avatar}
              alt={testimonial.author.name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10"
            />
          ) : (
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm',
              isFeatured
                ? 'bg-gradient-to-br from-cyan-500 to-cyan-500 text-white'
                : 'bg-white/10 text-white'
            )}>
              {testimonial.author.name.split(' ').map(n => n[0]).join('')}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-white truncate">
              {testimonial.author.name}
            </div>
            <div className="text-sm text-slate-400 truncate">
              {testimonial.author.title}
              {testimonial.author.company && (
                <> at <span className="text-slate-300">{testimonial.author.company}</span></>
              )}
            </div>
          </div>
          {testimonial.platform && (
            <div className="text-xs text-slate-500 px-2 py-1 rounded bg-white/5">
              {testimonial.platform}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Testimonial Grid Component
 */
export interface TestimonialGridProps {
  testimonials: Testimonial[];
  columns?: 1 | 2 | 3;
  className?: string;
}

export function TestimonialGrid({ testimonials, columns = 3, className }: TestimonialGridProps) {
  return (
    <div
      className={cn(
        'grid gap-6',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 md:grid-cols-2',
        columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {testimonials.map((testimonial, index) => (
        <TestimonialCard
          key={index}
          testimonial={testimonial}
          variant={index === 0 && columns > 1 ? 'featured' : 'default'}
        />
      ))}
    </div>
  );
}

export default TestimonialCard;
