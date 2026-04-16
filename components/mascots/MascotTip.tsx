'use client';

/**
 * MascotTip — SYN-646
 *
 * Weekly-rotating sidebar tip strip. Shows the currently scheduled persona
 * (cycles through all 24 over 24 weeks) with their contextual tip text.
 *
 * Usage: drop into any sidebar or dashboard widget area.
 *
 * @example
 * <MascotTip />
 */

import React from 'react';
import { MascotCard } from './MascotCard';
import { useMascot } from '@/hooks/use-mascot';

interface MascotTipProps {
  className?: string;
}

export function MascotTip({ className = '' }: MascotTipProps) {
  const { persona, imageUrl } = useMascot('dashboard-tip');

  return (
    <MascotCard
      persona={persona}
      imageUrl={imageUrl}
      variant="featured"
      className={className}
    />
  );
}
