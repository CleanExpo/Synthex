/**
 * Content Generator Configuration
 * Platform icons, hook types, and options
 */

import {
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Video,
} from '@/components/icons';
import type { HookType, ToneOption, Persona } from './types';

export const platformIcons = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Video,
};

export const hookTypes: HookType[] = [
  { value: 'question', label: 'Question', description: 'Engage with questions' },
  { value: 'story', label: 'Story', description: 'Tell compelling stories' },
  { value: 'educational', label: 'Educational', description: 'Teach and inform' },
  { value: 'achievement', label: 'Achievement', description: 'Share wins' },
  { value: 'controversy', label: 'Controversy', description: 'Spark debate' },
  { value: 'humor', label: 'Humor', description: 'Make them laugh' },
  { value: 'vulnerability', label: 'Vulnerability', description: 'Be authentic' },
  { value: 'relatable', label: 'Relatable', description: 'Connect emotionally' },
];

export const toneOptions: ToneOption[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'humorous', label: 'Humorous' },
];

export const lengthOptions = ['short', 'medium', 'long'] as const;

/**
 * @deprecated Use usePersonas hook to fetch real personas from database.
 * Kept for backwards compatibility only.
 */
export const defaultPersonas: Persona[] = [
  { id: '1', name: 'Professional Voice' },
  { id: '2', name: 'Casual Creator' },
  { id: '3', name: 'Thought Leader' },
];
