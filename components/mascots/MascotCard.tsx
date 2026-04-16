'use client';

/**
 * MascotCard — SYN-646
 *
 * Reusable persona card: avatar + name + role + optional quote.
 * Used in onboarding steps, empty states, success moments, and the
 * dashboard sidebar tip.
 *
 * Sizes:
 *   compact  — inline row: small avatar + name + quote (for empty states)
 *   standard — stacked: medium avatar + name + role + quote (for onboarding)
 *   featured — large avatar + name + role + full quote (for sidebar tip)
 */

import React from 'react';
import { MascotAvatar } from './MascotAvatar';
import type { MascotPersona } from './mascot-data';
import type { MascotAvatarSize } from './MascotAvatar';

export type MascotCardVariant = 'compact' | 'standard' | 'featured';

interface MascotCardProps {
  persona: MascotPersona;
  imageUrl: string;
  quote?: string;
  variant?: MascotCardVariant;
  className?: string;
}

const VARIANT_AVATAR_SIZE: Record<MascotCardVariant, MascotAvatarSize> = {
  compact: 'sm',
  standard: 'md',
  featured: 'lg',
};

export function MascotCard({
  persona,
  imageUrl,
  quote,
  variant = 'standard',
  className = '',
}: MascotCardProps) {
  const displayQuote = quote ?? persona.tipText;
  const avatarSize = VARIANT_AVATAR_SIZE[variant];

  if (variant === 'compact') {
    return (
      <div className={`flex items-start gap-3 ${className}`}>
        <MascotAvatar persona={persona} imageUrl={imageUrl} size={avatarSize} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-white/80 leading-none mb-1">
            {persona.name}
            <span className="text-white/40 font-normal">
              {' '}
              · {persona.title}
            </span>
          </p>
          <p className="text-xs text-white/60 leading-relaxed">
            {displayQuote}
          </p>
        </div>
      </div>
    );
  }

  if (variant === 'standard') {
    return (
      <div
        className={`flex flex-col items-center text-center gap-3 ${className}`}
      >
        <MascotAvatar persona={persona} imageUrl={imageUrl} size={avatarSize} />
        <div>
          <p className="text-sm font-semibold text-white">{persona.name}</p>
          <p className="text-xs text-white/50 mb-2">{persona.title}</p>
          {displayQuote && (
            <p className="text-sm text-white/70 leading-relaxed max-w-xs">
              "{displayQuote}"
            </p>
          )}
        </div>
      </div>
    );
  }

  // featured
  return (
    <div
      className={`p-4 rounded-xl border bg-white/[0.03] ${className}`}
      style={{ borderColor: `${persona.colour}30` }}
    >
      <div className="flex items-center gap-3 mb-3">
        <MascotAvatar persona={persona} imageUrl={imageUrl} size={avatarSize} />
        <div>
          <p className="text-sm font-semibold text-white">{persona.name}</p>
          <p className="text-xs" style={{ color: persona.colour }}>
            {persona.title}
          </p>
        </div>
      </div>
      {displayQuote && (
        <p className="text-sm text-white/70 leading-relaxed">
          "{displayQuote}"
        </p>
      )}
    </div>
  );
}
