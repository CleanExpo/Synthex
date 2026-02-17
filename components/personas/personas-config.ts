/**
 * Personas Configuration
 * Constants for personas page
 */

import { FileText, Mic, Video, Image, Link } from '@/components/icons';
import type { ContentType } from './types';

export const contentTypes: ContentType[] = [
  { icon: FileText, label: 'Text Document', type: 'text' },
  { icon: Mic, label: 'Audio/Podcast', type: 'audio' },
  { icon: Video, label: 'Video Content', type: 'video' },
  { icon: Image, label: 'Images', type: 'image' },
  { icon: Link, label: 'URL/Website', type: 'url' },
];

export const toneOptions = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'humorous', label: 'Humorous' },
];

export const styleOptions = [
  { value: 'formal', label: 'Formal' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'thought-provoking', label: 'Thought-provoking' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'educational', label: 'Educational' },
];

export const vocabularyOptions = [
  { value: 'simple', label: 'Simple' },
  { value: 'standard', label: 'Standard' },
  { value: 'technical', label: 'Technical' },
  { value: 'sophisticated', label: 'Sophisticated' },
];

export const emotionOptions = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'confident', label: 'Confident' },
  { value: 'inspiring', label: 'Inspiring' },
  { value: 'empathetic', label: 'Empathetic' },
  { value: 'enthusiastic', label: 'Enthusiastic' },
];

export const defaultNewPersona = {
  name: '',
  description: '',
  tone: 'professional',
  style: 'formal',
  vocabulary: 'standard',
  emotion: 'neutral',
};
