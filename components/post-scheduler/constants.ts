import {
  Twitter, Instagram, Linkedin, Youtube, Facebook, Globe,
} from '@/components/icons';

export const platformIcons = {
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Facebook,
  all: Globe
} as const;

export const platformColors = {
  twitter: 'bg-blue-500',
  instagram: 'bg-gradient-to-br from-cyan-600 to-pink-500',
  linkedin: 'bg-blue-700',
  youtube: 'bg-red-600',
  facebook: 'bg-blue-600',
  all: 'bg-gray-600'
} as const;

export const timeSlots = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
];
