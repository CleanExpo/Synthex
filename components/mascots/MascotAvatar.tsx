'use client';

/**
 * MascotAvatar — SYN-646
 *
 * Renders a persona avatar. Falls back to coloured initials circle when
 * the PNG asset hasn't been exported yet.
 *
 * PNG files go in: public/mascots/{filename}
 * Once Phill drops them in, they appear automatically — no code change needed.
 */

import React, { useState } from 'react';
import type { MascotPersona } from './mascot-data';

export type MascotAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<MascotAvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
  xl: 'w-24 h-24 text-xl',
};

interface MascotAvatarProps {
  persona: MascotPersona;
  imageUrl: string;
  size?: MascotAvatarSize;
  className?: string;
}

export function MascotAvatar({
  persona,
  imageUrl,
  size = 'md',
  className = '',
}: MascotAvatarProps) {
  // Default to TRUE so we never even attempt to fetch the PNG — none have
  // been exported yet (public/mascots/ contains only README.txt) and the
  // 404s pollute the dev console on every dashboard load. The initials
  // fallback below is the actual UI today. When PNGs are dropped into
  // public/mascots/, flip this back to `useState(false)` and the avatars
  // appear automatically.
  const [imgError, setImgError] = useState(true);
  const sizeClass = SIZE_CLASSES[size];

  if (imgError) {
    // Initials fallback — coloured ring matching persona brand colour
    return (
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center font-bold flex-shrink-0 ${className}`}
        style={{
          backgroundColor: `${persona.colour}22`,
          border: `2px solid ${persona.colour}`,
        }}
        aria-label={`${persona.name} — ${persona.title}`}
      >
        <span style={{ color: persona.colour }}>{persona.initials}</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={`${persona.name} — ${persona.title}`}
      className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
      style={{ border: `2px solid ${persona.colour}40` }}
      onError={() => setImgError(true)}
    />
  );
}
