'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Sparkles, Star } from '@/components/icons';

/**
 * Hero Section Component
 * Premium hero sections for marketing pages
 *
 * @task UNI-413 - Implement Marketing Page Components
 */

export interface HeroSectionProps {
  badge?: {
    text: string;
    href?: string;
    icon?: React.ReactNode;
  };
  headline: string;
  highlightedText?: string;
  subheadline?: string;
  primaryCTA: {
    text: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryCTA?: {
    text: string;
    href?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
  };
  stats?: Array<{
    value: string;
    label: string;
  }>;
  socialProof?: {
    avatars?: string[];
    text: string;
    rating?: number;
  };
  media?: React.ReactNode;
  variant?: 'centered' | 'split' | 'minimal';
  className?: string;
}

export function HeroSection({
  badge,
  headline,
  highlightedText,
  subheadline,
  primaryCTA,
  secondaryCTA,
  stats,
  socialProof,
  media,
  variant = 'centered',
  className,
}: HeroSectionProps) {
  const isCentered = variant === 'centered';
  const isSplit = variant === 'split';
  const isMinimal = variant === 'minimal';

  // Process headline with highlighted text
  const processHeadline = () => {
    if (!highlightedText) return headline;

    const parts = headline.split(highlightedText);
    if (parts.length === 1) return headline;

    return (
      <>
        {parts[0]}
        <span className="bg-gradient-to-r from-cyan-400 via-cyan-400 to-cyan-400 bg-clip-text text-transparent animate-gradient-x">
          {highlightedText}
        </span>
        {parts[1]}
      </>
    );
  };

  return (
    <section
      className={cn(
        'relative overflow-hidden',
        isCentered && 'text-center',
        className
      )}
    >
      <div className={cn(
        isSplit ? 'grid lg:grid-cols-2 gap-12 lg:gap-16 items-center' : ''
      )}>
        {/* Content */}
        <div className={cn(
          isCentered && 'max-w-4xl mx-auto',
          isMinimal && 'max-w-3xl'
        )}>
          {/* Badge */}
          {badge && (
            <div className="mb-6">
              {badge.href ? (
                <a
                  href={badge.href}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/15 transition-colors group"
                >
                  {badge.icon || <Sparkles className="w-4 h-4" />}
                  <span className="text-sm font-medium">{badge.text}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                  {badge.icon || <Sparkles className="w-4 h-4" />}
                  <span className="text-sm font-medium">{badge.text}</span>
                </span>
              )}
            </div>
          )}

          {/* Headline */}
          <h1 className={cn(
            'font-bold text-white leading-tight mb-6',
            isCentered ? 'text-4xl md:text-5xl lg:text-6xl xl:text-7xl' : 'text-3xl md:text-4xl lg:text-5xl',
            isMinimal && 'text-3xl md:text-4xl'
          )}>
            {processHeadline()}
          </h1>

          {/* Subheadline */}
          {subheadline && (
            <p className={cn(
              'text-slate-300 leading-relaxed mb-8',
              isCentered ? 'text-lg md:text-xl max-w-2xl mx-auto' : 'text-lg'
            )}>
              {subheadline}
            </p>
          )}

          {/* CTAs */}
          <div className={cn(
            'flex flex-wrap gap-4 mb-10',
            isCentered && 'justify-center'
          )}>
            {primaryCTA.href ? (
              <a href={primaryCTA.href}>
                <Button
                  size="lg"
                  className="font-semibold px-8 bg-gradient-to-r from-cyan-500 to-cyan-500 hover:from-cyan-400 hover:to-cyan-400 text-white shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:shadow-[0_0_40px_rgba(6,182,212,0.5)] transition-all duration-300"
                >
                  {primaryCTA.text}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </a>
            ) : (
              <Button
                size="lg"
                onClick={primaryCTA.onClick}
                className="font-semibold px-8 bg-gradient-to-r from-cyan-500 to-cyan-500 hover:from-cyan-400 hover:to-cyan-400 text-white shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:shadow-[0_0_40px_rgba(6,182,212,0.5)] transition-all duration-300"
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
                    className="font-semibold px-8 border-white/20 text-white hover:bg-white/10"
                  >
                    {secondaryCTA.icon || <Play className="w-5 h-5 mr-2" />}
                    {secondaryCTA.text}
                  </Button>
                </a>
              ) : (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={secondaryCTA.onClick}
                  className="font-semibold px-8 border-white/20 text-white hover:bg-white/10"
                >
                  {secondaryCTA.icon || <Play className="w-5 h-5 mr-2" />}
                  {secondaryCTA.text}
                </Button>
              )
            )}
          </div>

          {/* Social Proof */}
          {socialProof && (
            <div className={cn(
              'flex items-center gap-4',
              isCentered && 'justify-center'
            )}>
              {socialProof.avatars && socialProof.avatars.length > 0 && (
                <div className="flex -space-x-3">
                  {socialProof.avatars.slice(0, 5).map((avatar, index) => (
                    <img
                      key={index}
                      src={avatar}
                      alt="Customer testimonial avatar"
                      className="w-10 h-10 rounded-full border-2 border-slate-900 object-cover"
                    />
                  ))}
                </div>
              )}
              <div>
                {socialProof.rating && (
                  <div className="flex items-center gap-1 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'w-4 h-4',
                          i < socialProof.rating!
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-600'
                        )}
                      />
                    ))}
                  </div>
                )}
                <p className="text-sm text-slate-400">{socialProof.text}</p>
              </div>
            </div>
          )}

          {/* Stats */}
          {stats && stats.length > 0 && (
            <div className={cn(
              'grid gap-8 pt-10 mt-10 border-t border-white/10',
              stats.length === 2 && 'grid-cols-2',
              stats.length === 3 && 'grid-cols-3',
              stats.length >= 4 && 'grid-cols-2 md:grid-cols-4',
              isCentered && 'max-w-2xl mx-auto'
            )}>
              {stats.map((stat, index) => (
                <div key={index} className={isCentered ? 'text-center' : ''}>
                  <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                    {stat.value}
                  </div>
                  <div className="text-sm text-slate-400 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Media (for split variant) */}
        {isSplit && media && (
          <div className="relative">
            {media}
          </div>
        )}
      </div>

      {/* Media (for centered variant - below content) */}
      {isCentered && media && (
        <div className="mt-16 relative">
          {media}
        </div>
      )}
    </section>
  );
}

export default HeroSection;
