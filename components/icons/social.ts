/**
 * Social Media Icons
 * Using custom SVG icons for platform-specific brand icons
 *
 * @version 3.0.0
 * @updated 2026-02-10
 *
 * Migrated from react-icons to custom SVGs for smaller bundle size
 */

import {
  TwitterXIcon,
  InstagramIcon,
  LinkedInIcon,
  TikTokIcon,
  FacebookIcon,
  YouTubeIcon,
  GithubIcon,
  RedditIcon,
  PinterestIcon,
  ThreadsIcon,
} from './platform-icons';

// Re-export with consistent naming (matching old react-icons API)
export const Twitter = TwitterXIcon;
export const TwitterLegacy = TwitterXIcon; // Legacy alias
export const Facebook = FacebookIcon;
export const Instagram = InstagramIcon;
export const Linkedin = LinkedInIcon;
export const Youtube = YouTubeIcon;
export const TikTok = TikTokIcon;
export const Github = GithubIcon;
export const Reddit = RedditIcon;
export const Pinterest = PinterestIcon;
export const Threads = ThreadsIcon;

// Platform colors for reference
export const SocialColors = {
  twitter: '#1DA1F2',
  x: '#000000',
  facebook: '#1877F2',
  instagram: '#E4405F',
  linkedin: '#0A66C2',
  youtube: '#FF0000',
  tiktok: '#000000',
  pinterest: '#BD081C',
  reddit: '#FF4500',
  threads: '#000000',
} as const;

// Platform icon map for dynamic rendering
export const SocialIcons = {
  twitter: Twitter,
  x: Twitter,
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: TikTok,
  reddit: Reddit,
  pinterest: Pinterest,
  threads: Threads,
} as const;

// Type for social platform names
export type SocialPlatform = keyof typeof SocialIcons;

// Helper to get icon by platform name
export function getSocialIcon(platform: SocialPlatform) {
  return SocialIcons[platform.toLowerCase() as SocialPlatform] || Twitter;
}

// Helper to get platform color
export function getSocialColor(platform: SocialPlatform) {
  return SocialColors[platform.toLowerCase() as keyof typeof SocialColors] || '#6B7280';
}
