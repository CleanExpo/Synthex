/**
 * Sandbox Configuration
 * Platform configs, device presets, and utility functions
 */

import {
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Video,
  Smartphone,
  Tablet,
  Monitor,
} from '@/components/icons';
import type { PlatformConfig, DevicePreset } from './types';

export const platformConfigs: Record<string, PlatformConfig> = {
  twitter: {
    icon: Twitter,
    name: 'Twitter',
    maxChars: 280,
    features: ['hashtags', 'mentions', 'threads', 'media'],
    mockupBg: 'bg-black',
    textColor: 'text-white',
  },
  linkedin: {
    icon: Linkedin,
    name: 'LinkedIn',
    maxChars: 3000,
    features: ['hashtags', 'mentions', 'articles', 'media'],
    mockupBg: 'bg-white',
    textColor: 'text-gray-900',
  },
  instagram: {
    icon: Instagram,
    name: 'Instagram',
    maxChars: 2200,
    features: ['hashtags', 'mentions', 'reels', 'stories', 'carousel'],
    mockupBg: 'bg-gradient-to-br from-cyan-600 to-teal-500',
    textColor: 'text-white',
  },
  facebook: {
    icon: Facebook,
    name: 'Facebook',
    maxChars: 63206,
    features: ['hashtags', 'mentions', 'stories', 'media', 'links'],
    mockupBg: 'bg-blue-600',
    textColor: 'text-white',
  },
  tiktok: {
    icon: Video,
    name: 'TikTok',
    maxChars: 2200,
    features: ['hashtags', 'mentions', 'sounds', 'effects'],
    mockupBg: 'bg-black',
    textColor: 'text-white',
  },
};

export const devicePresets: Record<string, DevicePreset> = {
  mobile: { width: 375, height: 667, label: 'iPhone', icon: Smartphone },
  tablet: { width: 768, height: 1024, label: 'iPad', icon: Tablet },
  desktop: { width: 1440, height: 900, label: 'Desktop', icon: Monitor },
};

export function getValidationErrors(
  content: string,
  config: { maxChars: number },
  platform: string,
  hashtags: string[]
): string[] {
  const errors: string[] = [];

  if (content.length > config.maxChars) {
    errors.push(`Content exceeds ${config.maxChars} character limit`);
  }

  if (platform === 'twitter' && hashtags.length > 3) {
    errors.push('Too many hashtags (max 3 recommended)');
  }

  if (platform === 'instagram' && hashtags.length > 30) {
    errors.push('Too many hashtags (max 30)');
  }

  if (platform === 'tiktok' && !content.includes('#')) {
    errors.push('TikTok posts perform better with hashtags');
  }

  return errors;
}

export function extractHashtags(content: string): string[] {
  return content.match(/#\w+/g) || [];
}

export function extractMentions(content: string): string[] {
  return content.match(/@\w+/g) || [];
}

export function exportContent(content: string, platform: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${platform}-content-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
