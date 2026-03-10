/**
 * Platform Limits Configuration
 *
 * Lightweight config for platform display constraints used by
 * PlatformPreview and CharacterCounter components.
 */

export interface PlatformLimit {
  maxChars: number;
  maxMedia: number;
  mediaAspectRatio?: string;
  displayName: string;
  brandColour: string; // Tailwind class
  avatarBg: string; // Tailwind class
  features: {
    hashtags: boolean;
    mentions: boolean;
    links: boolean;
    threads: boolean;
  };
}

export const PLATFORM_LIMITS: Record<string, PlatformLimit> = {
  twitter: {
    maxChars: 280,
    maxMedia: 4,
    displayName: 'X (Twitter)',
    brandColour: 'text-sky-400',
    avatarBg: 'bg-sky-500/20',
    features: { hashtags: true, mentions: true, links: true, threads: true },
  },
  instagram: {
    maxChars: 2200,
    maxMedia: 10,
    mediaAspectRatio: '1:1',
    displayName: 'Instagram',
    brandColour: 'text-pink-400',
    avatarBg: 'bg-pink-500/20',
    features: { hashtags: true, mentions: true, links: false, threads: false },
  },
  linkedin: {
    maxChars: 3000,
    maxMedia: 9,
    displayName: 'LinkedIn',
    brandColour: 'text-blue-400',
    avatarBg: 'bg-blue-500/20',
    features: { hashtags: true, mentions: true, links: true, threads: false },
  },
  tiktok: {
    maxChars: 2200,
    maxMedia: 1,
    displayName: 'TikTok',
    brandColour: 'text-rose-400',
    avatarBg: 'bg-rose-500/20',
    features: { hashtags: true, mentions: true, links: false, threads: false },
  },
  facebook: {
    maxChars: 63206,
    maxMedia: 10,
    displayName: 'Facebook',
    brandColour: 'text-indigo-400',
    avatarBg: 'bg-indigo-500/20',
    features: { hashtags: true, mentions: true, links: true, threads: false },
  },
  youtube: {
    maxChars: 5000,
    maxMedia: 1,
    displayName: 'YouTube',
    brandColour: 'text-red-400',
    avatarBg: 'bg-red-500/20',
    features: { hashtags: true, mentions: false, links: true, threads: false },
  },
  pinterest: {
    maxChars: 500,
    maxMedia: 1,
    mediaAspectRatio: '2:3',
    displayName: 'Pinterest',
    brandColour: 'text-rose-500',
    avatarBg: 'bg-rose-500/20',
    features: { hashtags: true, mentions: false, links: true, threads: false },
  },
  reddit: {
    maxChars: 40000,
    maxMedia: 20,
    displayName: 'Reddit',
    brandColour: 'text-orange-400',
    avatarBg: 'bg-orange-500/20',
    features: { hashtags: false, mentions: true, links: true, threads: true },
  },
  threads: {
    maxChars: 500,
    maxMedia: 10,
    displayName: 'Threads',
    brandColour: 'text-slate-300',
    avatarBg: 'bg-slate-500/20',
    features: { hashtags: true, mentions: true, links: false, threads: true },
  },
};
