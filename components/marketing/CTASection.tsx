'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

/**
 * CTA Section Component
 * Call-to-action sections with glassmorphism design
 *
 * @task UNI-413 - Implement Marketing Page Components
 */

export interface CTASectionProps {
  title: string;
  description?: string;
  primaryCTA: {
    text: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryCTA?: {
    text: string;
    href?: string;
    onClick?: () => void;
  };
  badge?: string;
  variant?: 'default' | 'gradient' | 'centered' | 'split';
  className?: string;
  children?: React.ReactNode;
}

export function CTASection({
  title,
  description,
  primaryCTA,
  secondaryCTA,
  badge,
  variant = 'default',
  className,
  children,
}: CTASectionProps) {
  const isGradient = variant === 'gradient';
  const isCentered = variant === 'centered';
  const isSplit = variant === 'split';

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-3xl',
        isGradient
          ? 'bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600'
          : 'glass-primary',
        isCentered ? 'text-center' : '',
        className
      )}
    >
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

        {/* Glow effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/30 rounded-full blur-3xl" />

        {/* Gradient overlay for non-gradient variant */}
        {!isGradient && (
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-transparent to-fuchsia-500/10" />
        )}
      </div>

      <div className={cn(
        'relative z-10',
        isSplit ? 'flex flex-col lg:flex-row items-center justify-between gap-8 p-8 md:p-12' : 'p-8 md:p-16',
        isCentered && 'max-w-3xl mx-auto'
      )}>
        {/* Content */}
        <div className={cn(
          isSplit && 'lg:flex-1',
          isCentered && 'mb-8'
        )}>
          {/* Badge */}
          {badge && (
            <div className={cn(
              'inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6',
              isGradient
                ? 'bg-white/20 text-white'
                : 'bg-violet-500/20 text-violet-200 border border-violet-500/30'
            )}>
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">{badge}</span>
            </div>
          )}

          {/* Title */}
          <h2 className={cn(
            'font-bold text-white mb-4',
            isCentered || isSplit ? 'text-3xl md:text-4xl lg:text-5xl' : 'text-2xl md:text-3xl'
          )}>
            {title}
          </h2>

          {/* Description */}
          {description && (
            <p className={cn(
              'text-white/80 leading-relaxed',
              isCentered ? 'text-lg' : ''
            )}>
              {description}
            </p>
          )}

          {/* Additional content */}
          {children}
        </div>

        {/* CTAs */}
        <div className={cn(
          'flex gap-4',
          isCentered ? 'justify-center' : '',
          isSplit ? 'flex-shrink-0' : 'mt-8'
        )}>
          {primaryCTA.href ? (
            <a href={primaryCTA.href}>
              <Button
                size="lg"
                className={cn(
                  'font-semibold px-8 transition-all duration-300',
                  isGradient
                    ? 'bg-white text-violet-600 hover:bg-white/90 shadow-lg hover:shadow-xl'
                    : 'bg-white text-violet-600 hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                )}
              >
                {primaryCTA.text}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </a>
          ) : (
            <Button
              size="lg"
              onClick={primaryCTA.onClick}
              className={cn(
                'font-semibold px-8 transition-all duration-300',
                isGradient
                  ? 'bg-white text-violet-600 hover:bg-white/90 shadow-lg hover:shadow-xl'
                  : 'bg-white text-violet-600 hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
              )}
            >
              {primaryCTA.text}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          )}

          {secondaryCTA && (
            secondaryCTA.href ? (
              <a href={secondaryCTA.href}>
                <Button
                  size="lg"
                  variant="outline"
                  className="font-semibold px-8 border-white/30 text-white hover:bg-white/10"
                >
                  {secondaryCTA.text}
                </Button>
              </a>
            ) : (
              <Button
                size="lg"
                variant="outline"
                onClick={secondaryCTA.onClick}
                className="font-semibold px-8 border-white/30 text-white hover:bg-white/10"
              >
                {secondaryCTA.text}
              </Button>
            )
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Mini CTA Component
 * Smaller inline CTA for use within sections
 */
export interface MiniCTAProps {
  text: string;
  linkText: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function MiniCTA({ text, linkText, href, onClick, className }: MiniCTAProps) {
  const LinkContent = (
    <span className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300 font-medium transition-colors group">
      {linkText}
      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
    </span>
  );

  return (
    <div className={cn(
      'flex items-center justify-center gap-2 text-sm text-slate-400',
      className
    )}>
      {text}
      {href ? (
        <a href={href}>{LinkContent}</a>
      ) : (
        <button onClick={onClick}>{LinkContent}</button>
      )}
    </div>
  );
}

export default CTASection;
