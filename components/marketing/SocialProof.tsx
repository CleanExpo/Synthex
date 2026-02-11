'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Star, Shield, Award, Check } from 'lucide-react';

/**
 * Social Proof Components
 * Trust signals and social proof elements
 *
 * @task UNI-413 - Implement Marketing Page Components
 */

// ============================================================================
// LOGO CLOUD
// ============================================================================

export interface Logo {
  name: string;
  src?: string;
  href?: string;
}

export interface LogoCloudProps {
  title?: string;
  logos: Logo[];
  variant?: 'default' | 'grayscale' | 'animated';
  className?: string;
}

export function LogoCloud({ title, logos, variant = 'default', className }: LogoCloudProps) {
  const isAnimated = variant === 'animated';
  const isGrayscale = variant === 'grayscale';

  return (
    <div className={cn('text-center', className)}>
      {title && (
        <p className="text-sm text-slate-400 mb-8">{title}</p>
      )}

      <div className={cn(
        'relative overflow-hidden',
        isAnimated && 'mask-gradient'
      )}>
        <div className={cn(
          'flex items-center gap-12 justify-center flex-wrap',
          isAnimated && 'animate-scroll'
        )}>
          {logos.map((logo, index) => {
            const LogoContent = (
              <div
                key={index}
                className={cn(
                  'flex items-center justify-center h-12 px-4 transition-all duration-300',
                  isGrayscale
                    ? 'grayscale opacity-50 hover:grayscale-0 hover:opacity-100'
                    : 'opacity-60 hover:opacity-100'
                )}
              >
                {logo.src ? (
                  <img
                    src={logo.src}
                    alt={logo.name}
                    className="h-8 w-auto object-contain"
                  />
                ) : (
                  <span className="text-lg font-semibold text-slate-400">
                    {logo.name}
                  </span>
                )}
              </div>
            );

            return logo.href ? (
              <a key={index} href={logo.href} target="_blank" rel="noopener noreferrer">
                {LogoContent}
              </a>
            ) : (
              LogoContent
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TRUST BADGES
// ============================================================================

export interface TrustBadge {
  icon: React.ReactNode;
  title: string;
  description?: string;
}

export interface TrustBadgesProps {
  badges: TrustBadge[];
  variant?: 'default' | 'compact' | 'inline';
  className?: string;
}

export function TrustBadges({ badges, variant = 'default', className }: TrustBadgesProps) {
  const isCompact = variant === 'compact';
  const isInline = variant === 'inline';

  if (isInline) {
    return (
      <div className={cn('flex flex-wrap items-center justify-center gap-6', className)}>
        {badges.map((badge, index) => (
          <div key={index} className="flex items-center gap-2 text-sm text-slate-400">
            <span className="text-emerald-400">{badge.icon}</span>
            <span>{badge.title}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(
      'grid gap-6',
      badges.length <= 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4',
      className
    )}>
      {badges.map((badge, index) => (
        <div
          key={index}
          className={cn(
            'flex items-center gap-3 p-4 rounded-xl glass',
            isCompact && 'p-3'
          )}
        >
          <div className={cn(
            'flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400',
            isCompact ? 'w-10 h-10' : 'w-12 h-12'
          )}>
            {badge.icon}
          </div>
          <div>
            <div className={cn(
              'font-medium text-white',
              isCompact && 'text-sm'
            )}>
              {badge.title}
            </div>
            {badge.description && !isCompact && (
              <div className="text-xs text-slate-400">{badge.description}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// RATING DISPLAY
// ============================================================================

export interface RatingDisplayProps {
  rating: number;
  maxRating?: number;
  count?: number;
  platform?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function RatingDisplay({
  rating,
  maxRating = 5,
  count,
  platform,
  size = 'md',
  className,
}: RatingDisplayProps) {
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const starSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div className={cn('flex items-center gap-2', sizeClasses[size], className)}>
      <div className="flex gap-0.5">
        {Array.from({ length: maxRating }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              starSizes[size],
              i < Math.floor(rating)
                ? 'fill-amber-400 text-amber-400'
                : i < rating
                  ? 'fill-amber-400/50 text-amber-400'
                  : 'text-slate-600'
            )}
          />
        ))}
      </div>
      <span className="font-semibold text-white">{rating.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-slate-400">
          ({count.toLocaleString()} {count === 1 ? 'review' : 'reviews'})
        </span>
      )}
      {platform && (
        <span className="text-slate-500">on {platform}</span>
      )}
    </div>
  );
}

// ============================================================================
// AWARDS / ACCOLADES
// ============================================================================

export interface Accolade {
  title: string;
  source: string;
  year?: string;
  icon?: React.ReactNode;
  href?: string;
}

export interface AccoladesProps {
  accolades: Accolade[];
  className?: string;
}

export function Accolades({ accolades, className }: AccoladesProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-6', className)}>
      {accolades.map((accolade, index) => {
        const Content = (
          <div
            className="flex items-center gap-3 px-4 py-2 rounded-xl glass hover:bg-white/[0.08] transition-colors"
          >
            <div className="text-amber-400">
              {accolade.icon || <Award className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-sm font-medium text-white">{accolade.title}</div>
              <div className="text-xs text-slate-400">
                {accolade.source}
                {accolade.year && ` · ${accolade.year}`}
              </div>
            </div>
          </div>
        );

        return accolade.href ? (
          <a key={index} href={accolade.href} target="_blank" rel="noopener noreferrer">
            {Content}
          </a>
        ) : (
          <div key={index}>{Content}</div>
        );
      })}
    </div>
  );
}

// ============================================================================
// USER COUNT
// ============================================================================

export interface UserCountProps {
  count: number;
  label?: string;
  avatars?: string[];
  className?: string;
}

export function UserCount({ count, label = 'users trust us', avatars, className }: UserCountProps) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      {avatars && avatars.length > 0 && (
        <div className="flex -space-x-3">
          {avatars.slice(0, 5).map((avatar, index) => (
            <img
              key={index}
              src={avatar}
              alt=""
              className="w-10 h-10 rounded-full border-2 border-slate-900 object-cover"
            />
          ))}
          {avatars.length > 5 && (
            <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-cyan-500/20 flex items-center justify-center text-xs font-medium text-cyan-300">
              +{avatars.length - 5}
            </div>
          )}
        </div>
      )}
      <div>
        <div className="font-semibold text-white">
          {count >= 1000
            ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K+`
            : count.toLocaleString()
          }
        </div>
        <div className="text-sm text-slate-400">{label}</div>
      </div>
    </div>
  );
}

// ============================================================================
// SECURITY BADGES
// ============================================================================

export interface SecurityBadge {
  name: string;
  icon?: React.ReactNode;
}

export interface SecurityBadgesProps {
  badges?: SecurityBadge[];
  className?: string;
}

const defaultSecurityBadges: SecurityBadge[] = [
  { name: 'SOC 2 Compliant', icon: <Shield className="w-4 h-4" /> },
  { name: 'GDPR Ready', icon: <Check className="w-4 h-4" /> },
  { name: 'SSL Encrypted', icon: <Shield className="w-4 h-4" /> },
  { name: '99.9% Uptime', icon: <Check className="w-4 h-4" /> },
];

export function SecurityBadges({ badges = defaultSecurityBadges, className }: SecurityBadgesProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-4', className)}>
      {badges.map((badge, index) => (
        <div
          key={index}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"
        >
          {badge.icon}
          <span>{badge.name}</span>
        </div>
      ))}
    </div>
  );
}

export default {
  LogoCloud,
  TrustBadges,
  RatingDisplay,
  Accolades,
  UserCount,
  SecurityBadges,
};
