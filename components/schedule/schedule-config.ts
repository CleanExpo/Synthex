/**
 * Schedule Configuration
 * Constants for schedule page
 */

import { Twitter, Linkedin, Instagram, Facebook, Video } from '@/components/icons';

// Platform icons mapping
export const platformIcons: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Video,
};

// Best times to post per platform
export const bestTimes: Record<string, string[]> = {
  twitter: ['9:00 AM', '12:00 PM', '3:00 PM', '7:00 PM'],
  linkedin: ['8:00 AM', '12:00 PM', '5:00 PM'],
  instagram: ['11:00 AM', '1:00 PM', '5:00 PM', '8:00 PM'],
  facebook: ['9:00 AM', '1:00 PM', '3:00 PM', '8:00 PM'],
  tiktok: ['6:00 AM', '10:00 AM', '7:00 PM', '10:00 PM'],
};

// Platform filter options
export const platformOptions = [
  { value: 'all', label: 'All Platforms' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
];

// Status filter options
export const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
];

// Helper to get platform icon component
export function getPlatformIconComponent(platform: string) {
  return platformIcons[platform] || null;
}
