/**
 * Personas Configuration
 * Constants and mock data
 */

import { FileText, Mic, Video, Image, Link } from 'lucide-react';
import type { Persona, ContentType } from './types';

export const mockPersonas: Persona[] = [
  {
    id: 1,
    name: 'Professional Voice',
    description: 'Formal, authoritative tone for B2B content',
    trainingData: {
      sources: 12,
      words: 45000,
      samples: 156,
    },
    attributes: {
      tone: 'Professional',
      style: 'Formal',
      vocabulary: 'Technical',
      emotion: 'Confident',
    },
    accuracy: 94,
    status: 'active',
    lastTrained: '2024-01-10',
  },
  {
    id: 2,
    name: 'Casual Creator',
    description: 'Friendly, conversational style for social media',
    trainingData: {
      sources: 8,
      words: 28000,
      samples: 89,
    },
    attributes: {
      tone: 'Casual',
      style: 'Conversational',
      vocabulary: 'Simple',
      emotion: 'Friendly',
    },
    accuracy: 87,
    status: 'active',
    lastTrained: '2024-01-12',
  },
  {
    id: 3,
    name: 'Thought Leader',
    description: 'Insightful, provocative content for LinkedIn',
    trainingData: {
      sources: 15,
      words: 62000,
      samples: 203,
    },
    attributes: {
      tone: 'Authoritative',
      style: 'Thought-provoking',
      vocabulary: 'Sophisticated',
      emotion: 'Inspiring',
    },
    accuracy: 91,
    status: 'training',
    lastTrained: '2024-01-15',
  },
];

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
