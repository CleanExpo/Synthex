/**
 * Viral method cards — the nexus-viral shot grammar (pattern-interrupt open,
 * 3-beat retention, loop-back close) shipped as data in
 * ./viral-method-cards.json and bridged into the base MethodCard shape so the
 * existing composer and generation path consume them unchanged. The viral deck
 * sits alongside the base deck; it never replaces it.
 */
import type { MethodCard } from './method-cards';
import doc from './viral-method-cards.json';

export interface ViralBeat {
  id: string;
  window: string; // "start-ends" within the clip, e.g. "0.5-2.0s"
  rule: string;
}

export interface ViralSafeZone {
  bottomReservedPct: number;
  rightReservedPct: number;
  captionMaxLines: number;
  captionLeadMs: number;
  mutedLegible: boolean;
}

export interface ViralMethodCard {
  id: string;
  label: string;
  intent: string;
  aspect?: string;
  maxDurationSec?: number;
  beats?: ViralBeat[];
  modifiers?: string[];
  rule?: string;
  requires?: string[];
  delegates?: Record<string, string>;
  negative?: string[];
}

export const VIRAL_CARDS_VERSION: string = doc.version;
export const VIRAL_METHOD_CARDS: ViralMethodCard[] = doc.cards;
export const VIRAL_SAFE_ZONE: ViralSafeZone = doc.safeZone;

export function getViralCard(id: string): ViralMethodCard | undefined {
  return VIRAL_METHOD_CARDS.find(c => c.id === id);
}

// Delegation notes like "(from nexus-copywriter)" are orchestration metadata,
// not visual direction — they never reach the provider prompt.
const DELEGATE_NOTE = /\s*\(from [^)]+\)/g;

const EXAMPLE_SUBJECTS: Record<string, [string, string, string]> = {
  'viral-hero-short': [
    'a 3-second water-damage myth',
    'the espresso mistake every café makes',
    'a tradie hack that saves an hour on site',
  ],
  'pattern-interrupt-open': [
    'a burst pipe spraying in slow motion',
    'a barista catching a falling cup',
    'a paint tin tipping toward white carpet',
  ],
  'retention-3beat': [
    'three signs of hidden mould',
    'three coffee orders that slow the queue',
    'three tools every apprentice forgets',
  ],
  'loop-back-close': [
    'a restored floor reveal that loops',
    'a latte-art pour that ends where it began',
    'a job-site pan that resets to frame one',
  ],
};

const FALLBACK_EXAMPLES: [string, string, string] = [
  'a before-and-after restoration moment',
  'a café counter at morning rush',
  'a tradie demonstrating one quick fix',
];

export function viralToMethodCard(card: ViralMethodCard): MethodCard {
  const strip = (text: string) => text.replace(DELEGATE_NOTE, '');
  const parts = [`${strip(card.intent)}, featuring {{subject}}`];
  if (card.beats?.length) {
    parts.push(
      `timed beats: ${card.beats
        .map(b => `${b.window} ${strip(b.rule)}`)
        .join('; ')}`
    );
  }
  if (card.modifiers?.length) parts.push(card.modifiers.map(strip).join(', '));
  if (card.rule) parts.push(strip(card.rule));

  return {
    id: card.id,
    name: card.label,
    description: card.intent,
    thumbnail: `/video-cards/${card.id}.jpg`,
    promptScaffold: parts.join('. '),
    negativePrompt: card.negative?.length
      ? card.negative.join(', ')
      : undefined,
    params: {},
    requiresImage: false,
    category: 'viral',
    exampleSubjects: EXAMPLE_SUBJECTS[card.id] ?? FALLBACK_EXAMPLES,
  };
}

export const VIRAL_METHOD_CARDS_AS_METHOD: MethodCard[] =
  VIRAL_METHOD_CARDS.map(viralToMethodCard);

export function getViralMethodCard(id: string): MethodCard | undefined {
  return VIRAL_METHOD_CARDS_AS_METHOD.find(c => c.id === id);
}
