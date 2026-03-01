import {
  Twitter, Instagram, Linkedin, Youtube, Facebook, MessageSquare,
} from '@/components/icons';

export const platformIcons = {
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Facebook,
  tiktok: MessageSquare
};

export const platformColors = {
  twitter: 'bg-blue-500',
  instagram: 'bg-gradient-to-br from-cyan-600 to-pink-500',
  linkedin: 'bg-blue-700',
  youtube: 'bg-red-600',
  facebook: 'bg-blue-600',
  tiktok: 'bg-black'
};

export const getViralScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
};

export const getEngagementColor = (rate: number) => {
  if (rate >= 4) return 'text-green-500';
  if (rate >= 2.5) return 'text-yellow-500';
  return 'text-orange-500';
};
