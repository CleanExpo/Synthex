/**
 * Personas Types
 * Type definitions for persona management
 */

export interface TrainingData {
  sources: number;
  words: number;
  samples: number;
}

export interface PersonaAttributes {
  tone: string;
  style: string;
  vocabulary: string;
  emotion: string;
}

export type PersonaStatus = 'active' | 'training' | 'draft';

export interface Persona {
  id: number;
  name: string;
  description: string;
  trainingData: TrainingData;
  attributes: PersonaAttributes;
  accuracy: number;
  status: PersonaStatus;
  lastTrained: string;
}

export interface NewPersonaForm {
  name: string;
  description: string;
  tone: string;
  style: string;
  vocabulary: string;
  emotion: string;
}

export interface ContentType {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  type: string;
}

export interface PersonaStats {
  activeCount: number;
  totalWords: string;
  avgAccuracy: string;
  totalSources: number;
}
