/**
 * Schedule Configuration
 * Constants and mock data for schedule page
 */

import { Twitter, Linkedin, Instagram, Facebook, Video } from '@/components/icons';
import type { ScheduledPost } from '@/components/calendar';

// Platform icons mapping
export const platformIcons: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Video,
};

// Mock scheduled posts for demo
export const mockScheduledPosts: ScheduledPost[] = [
  {
    id: '1',
    content: "🚀 Just shipped our biggest feature yet! AI-powered content generation is now live. Who's ready to 10x their social media game?",
    platforms: ['twitter'],
    scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000),
    status: 'scheduled',
    engagement: { estimated: 8.5 },
    persona: 'Professional Voice',
  },
  {
    id: '2',
    content: "After 3 months of development, we're excited to announce that Synthex is transforming how businesses approach social media...",
    platforms: ['linkedin'],
    scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: 'scheduled',
    engagement: { estimated: 12.3 },
    persona: 'Thought Leader',
  },
  {
    id: '3',
    content: "POV: You just discovered the tool that writes viral content for you 🤯 #ContentCreation #AI #SocialMedia",
    platforms: ['tiktok', 'instagram'],
    scheduledFor: new Date(Date.now() + 48 * 60 * 60 * 1000),
    status: 'scheduled',
    engagement: { estimated: 25.7 },
    persona: 'Casual Creator',
  },
  {
    id: '4',
    content: "Behind the scenes of building an AI startup 📸 Swipe to see our journey from idea to launch →",
    platforms: ['instagram'],
    scheduledFor: new Date(Date.now() - 24 * 60 * 60 * 1000),
    status: 'published',
    engagement: { actual: 15.2, likes: 1250, comments: 89, shares: 45 },
    persona: 'Casual Creator',
  },
  {
    id: '5',
    content: "New blog post: 10 AI tools that will transform your marketing in 2024. Link in bio! 🔗",
    platforms: ['twitter', 'linkedin', 'facebook'],
    scheduledFor: new Date(Date.now() + 72 * 60 * 60 * 1000),
    status: 'scheduled',
    engagement: { estimated: 6.8 },
  },
];

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
