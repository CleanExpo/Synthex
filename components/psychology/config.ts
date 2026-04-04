/**
 * Psychology Analysis Config
 * Constants and utilities for psychology analysis
 */

import {
  Target,
  Zap,
  Heart,
  Shield,
  Check,
  Sparkles,
  Lightbulb,
} from '@/components/icons';
import type { Platform, ContentType } from './types';

export const PLATFORMS: Platform[] = [
  { id: 'twitter', name: 'Twitter/X', maxLength: 280 },
  { id: 'linkedin', name: 'LinkedIn', maxLength: 3000 },
  { id: 'instagram', name: 'Instagram', maxLength: 2200 },
  { id: 'facebook', name: 'Facebook', maxLength: 63206 },
  { id: 'tiktok', name: 'TikTok', maxLength: 2200 },
  { id: 'youtube', name: 'YouTube', maxLength: 5000 },
  { id: 'pinterest', name: 'Pinterest', maxLength: 500 },
  { id: 'reddit', name: 'Reddit', maxLength: 40000 },
  { id: 'threads', name: 'Threads', maxLength: 500 },
  { id: 'email', name: 'Email', maxLength: 10000 },
  { id: 'web', name: 'Website', maxLength: 10000 },
];

export const CONTENT_TYPES: ContentType[] = [
  { id: 'post', name: 'Social Post' },
  { id: 'ad', name: 'Advertisement' },
  { id: 'email', name: 'Email' },
  { id: 'landing', name: 'Landing Page' },
  { id: 'tagline', name: 'Tagline' },
  { id: 'headline', name: 'Headline' },
];

export const PRINCIPLE_ICONS: Record<string, React.ElementType> = {
  'Social Proof': Target,
  'Scarcity': Zap,
  'Reciprocity': Heart,
  'Authority': Shield,
  'Commitment': Check,
  'Liking': Sparkles,
};

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

export function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function getDefaultPrincipleIcon() {
  return Lightbulb;
}
