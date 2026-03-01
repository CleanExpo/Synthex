/**
 * Helper functions for persona data transformation.
 * Extracted from app/dashboard/personas/page.tsx.
 */

import type { Persona } from './types';
import type { Persona as APIPersona } from '@/hooks/use-personas';

/** Transform an API persona to the component Persona type */
export function transformPersona(p: APIPersona): Persona {
  return {
    id: parseInt(p.id, 10) || Date.now(),
    name: p.name || '',
    description: p.description || '',
    trainingData: {
      sources: p.trainingSourcesCount || 0,
      words: p.trainingWordsCount || 0,
      samples: p.trainingSamplesCount || 0,
    },
    attributes: {
      tone: (p.tone || 'Professional').charAt(0).toUpperCase() + (p.tone || 'professional').slice(1),
      style: (p.style || 'Formal').charAt(0).toUpperCase() + (p.style || 'formal').slice(1),
      vocabulary: (p.vocabulary || 'Standard').charAt(0).toUpperCase() + (p.vocabulary || 'standard').slice(1),
      emotion: (p.emotion || 'Neutral').charAt(0).toUpperCase() + (p.emotion || 'neutral').slice(1),
    },
    accuracy: p.accuracy || 0,
    status: (p.status as Persona['status']) || 'draft',
    lastTrained: p.lastTrained ? new Date(p.lastTrained).toLocaleDateString() : 'Never',
  };
}

/** Find API persona ID from component persona ID */
export function findApiId(apiPersonas: APIPersona[], componentId: number): string | null {
  const found = apiPersonas.find((p) => parseInt(p.id, 10) === componentId || p.id === String(componentId));
  return found?.id || null;
}
