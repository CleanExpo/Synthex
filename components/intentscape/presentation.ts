import type { VisionLens } from '@/lib/intentscape/contracts';

export interface CanvasPosition {
  x: number;
  y: number;
}

export const LENS_PRESENTATION: Record<
  VisionLens,
  { short: string; label: string; prompt: string; colour: string }
> = {
  'signal-separation': {
    short: '01',
    label: 'Signal separation',
    prompt: 'What is fact, interpretation, assumption or noise?',
    colour: 'var(--sx-info)',
  },
  'upstream-causes': {
    short: '02',
    label: 'Upstream causes',
    prompt: 'What created the situation before the visible problem?',
    colour: 'rgb(var(--color-info))',
  },
  'downstream-effects': {
    short: '03',
    label: 'Downstream effects',
    prompt: 'What changes next if the signal is acted on or ignored?',
    colour: 'var(--sx-success)',
  },
  'stakeholder-shifts': {
    short: '04',
    label: 'Stakeholder shifts',
    prompt: 'Who gains, loses, decides, blocks or experiences the change?',
    colour: 'rgb(var(--color-success))',
  },
  'outside-analogies': {
    short: '05',
    label: 'Outside analogies',
    prompt: 'Where has a different field solved the same mechanism?',
    colour: 'var(--sx-warning)',
  },
  counterfactuals: {
    short: '06',
    label: 'Counterfactuals',
    prompt: 'What would need to be true for the opposite answer to win?',
    colour: 'var(--sx-accent)',
  },
  'adjacent-value': {
    short: '07',
    label: 'Adjacent value',
    prompt: 'What valuable opportunity sits beside the stated request?',
    colour: 'var(--sx-danger)',
  },
};

export const DEFAULT_LENS_POSITIONS: Record<VisionLens, CanvasPosition> = {
  'signal-separation': { x: 13, y: 13 },
  'upstream-causes': { x: 42, y: 8 },
  'downstream-effects': { x: 70, y: 16 },
  'stakeholder-shifts': { x: 22, y: 44 },
  'outside-analogies': { x: 57, y: 43 },
  counterfactuals: { x: 12, y: 74 },
  'adjacent-value': { x: 68, y: 73 },
};

export const WORKSPACE_STATE_LABELS: Record<string, string> = {
  draft: 'Draft signal',
  context_ready: 'Context ready',
  expanding: 'Agents exploring',
  awaiting_approval: 'Decision required',
  goal_approved: 'Goal approved',
  blocked: 'Needs more evidence',
  failed: 'Expansion interrupted',
};

export function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

export function hostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}

export function suggestExplorationTitle(originSignal: string): string {
  const compact = originSignal.replace(/\s+/g, ' ').trim();
  const firstThought = compact.split(/[.!?](?:\s|$)/)[0] ?? compact;
  if (firstThought.length <= 72) return firstThought;
  return `${firstThought.slice(0, 69).trimEnd()}…`;
}
