/**
 * useMascot — context-based persona selector — SYN-646
 *
 * Maps an app context string to the most appropriate board persona.
 * Returns { persona, imageUrl, hasPng } so callers can render the
 * avatar with PNG or fall back to initials.
 */

import { useMemo } from 'react';
import {
  MASCOTS,
  MASCOT_LIST,
  type MascotId,
  type MascotPersona,
} from '@/components/mascots/mascot-data';

// ── Context type ──────────────────────────────────────────────────────────────

export type MascotContext =
  // Onboarding steps
  | 'onboarding-welcome'
  | 'onboarding-goals'
  | 'onboarding-integrations'
  | 'onboarding-social'
  // Empty states
  | 'empty-content'
  | 'empty-analytics'
  | 'empty-campaigns'
  | 'empty-schedule'
  | 'empty-platforms'
  | 'empty-search'
  | 'empty-generic'
  // Loading states
  | 'loading-ai'
  | 'loading-generic'
  // Error states
  | 'error-generic'
  | 'error-auth'
  // Success moments
  | 'success-milestone'
  | 'success-post'
  | 'success-campaign'
  // Dashboard surfaces
  | 'advisor'
  | 'analytics'
  | 'geo-score'
  | 'content-score'
  | 'dashboard-tip'; // weekly rotation across all 24

// ── Context → persona map ────────────────────────────────────────────────────

const CONTEXT_MAP: Record<MascotContext, MascotId> = {
  'onboarding-welcome': 'ceo',
  'onboarding-goals': 'product',
  'onboarding-integrations': 'technical',
  'onboarding-social': 'social-pr-director',

  'empty-content': 'social-pr-director',
  'empty-analytics': 'market',
  'empty-campaigns': 'cmo',
  'empty-schedule': 'senior-pm',
  'empty-platforms': 'technical',
  'empty-search': 'algorithm-engineer',
  'empty-generic': 'moonshot',

  'loading-ai': 'ai-ml-engineer',
  'loading-generic': 'technical',

  'error-generic': 'qa-engineer',
  'error-auth': 'security-engineer',

  'success-milestone': 'ceo',
  'success-post': 'social-pr-director',
  'success-campaign': 'revenue',

  advisor: 'oracle',
  analytics: 'bigdata-architect',
  'geo-score': 'market',
  'content-score': 'algorithm-engineer',

  // Resolved at runtime via weekly rotation
  'dashboard-tip': 'ceo',
};

// ── Weekly rotation for dashboard tip ────────────────────────────────────────

function getWeeklyPersona(): MascotPersona {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weekIndex = Math.floor(Date.now() / msPerWeek);
  return MASCOT_LIST[weekIndex % MASCOT_LIST.length];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseMascotResult {
  persona: MascotPersona;
  imageUrl: string;
}

/**
 * Returns the appropriate persona and image URL for a given app context.
 *
 * @example
 * const { persona, imageUrl } = useMascot('empty-analytics');
 */
export function useMascot(context: MascotContext): UseMascotResult {
  return useMemo(() => {
    const persona =
      context === 'dashboard-tip'
        ? getWeeklyPersona()
        : MASCOTS[CONTEXT_MAP[context]];

    const imageUrl = `/mascots/${persona.filename}`;

    return { persona, imageUrl };
  }, [context]);
}

/**
 * Returns a persona by explicit ID (bypass the context map).
 * Used when the caller knows exactly which persona they want.
 */
export function useMascotById(id: MascotId): UseMascotResult {
  return useMemo(() => {
    const persona = MASCOTS[id];
    return { persona, imageUrl: `/mascots/${persona.filename}` };
  }, [id]);
}
