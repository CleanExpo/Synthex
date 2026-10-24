/**
 * Format template (clone the structure, swap the host and topic), the Margot
 * default character, and the show-while-she-tells beat plan.
 *
 * Adapted from Hypit (hypit-ai/hypit, modified Apache 2.0), commit e26d914.
 * Idea from examples/ranking-football/swap-host.svml, swap-topic.svml and
 * variants.md: one reference workflow, variants change slots, structure stays.
 * Hypit swaps slots by editing markup; here a template is plain data.
 *
 * Visuals are data in the plan: type, source, start word and end word. Their
 * on-screen window comes from word timing, not from seconds written by hand.
 */
import type { AnchoredScript, WordSpan } from './anchored-script';
import type { WordTiming } from './word-timing';

// ---------------------------------------------------------------------------
// Margot default character
// ---------------------------------------------------------------------------

export class MargotConfigError extends Error {
  constructor(missing: string[]) {
    super(
      `Margot is not configured: set ${missing.join(' and ')}. ` +
        'There is no stand-in voice or avatar, so a different voice can never pass as Margot.'
    );
    this.name = 'MargotConfigError';
  }
}

export interface MargotCharacter {
  name: 'Margot';
  /** ElevenLabs voice id. */
  voiceId: string;
  /** HeyGen avatar id. */
  avatarId: string;
}

const PLACEHOLDER = /^PLACEHOLDER/i;

export function resolveMargot(
  env: Record<string, string | undefined> = process.env
): MargotCharacter {
  const voiceId = env.MARGOT_ELEVENLABS_VOICE_ID?.trim();
  const avatarId = env.MARGOT_HEYGEN_AVATAR_ID?.trim();
  const missing: string[] = [];
  if (!voiceId || PLACEHOLDER.test(voiceId))
    missing.push('MARGOT_ELEVENLABS_VOICE_ID');
  if (!avatarId || PLACEHOLDER.test(avatarId))
    missing.push('MARGOT_HEYGEN_AVATAR_ID');
  if (missing.length) throw new MargotConfigError(missing);
  return { name: 'Margot', voiceId: voiceId!, avatarId: avatarId! };
}

// ---------------------------------------------------------------------------
// Beats and visuals
// ---------------------------------------------------------------------------

/** Real footage first, then Remotion for data. Never AI-generated scenery. */
export const VISUAL_TYPES = [
  'job-footage',
  'job-photo',
  'screen-recording',
  'stock',
  'remotion',
] as const;
export type VisualType = (typeof VISUAL_TYPES)[number];

/** How Margot is shown during a beat. */
export type MargotLayout = 'full' | 'pip' | 'split' | 'off';

export interface BeatVisual {
  type: VisualType;
  /** Path or URL of the footage, photo, recording or Remotion composition. */
  source: string;
  /** Script word index the visual comes in on. */
  startWord: number;
  /** Script word index the visual goes out after (inclusive). */
  endWord: number;
}

export interface BeatSpec {
  /** Matches an `@{id}` anchor in the script. */
  id: string;
  margot: MargotLayout;
  visual?: BeatVisual;
}

export interface ViralFormatTemplate {
  id: string;
  /** Anchored script; `{{slot}}` placeholders are filled from `slots`. */
  script: string;
  slots: Record<string, string>;
  host: string;
  beats: BeatSpec[];
}

export function swapSlots(
  template: ViralFormatTemplate,
  overrides: Record<string, string> = {}
): ViralFormatTemplate {
  const { host, ...slotOverrides } = overrides;
  const slots = { ...template.slots, ...slotOverrides };
  const script = template.script.replace(
    /\{\{([A-Za-z0-9_-]+)\}\}/g,
    (_m, name: string) => {
      const value = slots[name]?.trim();
      if (!value) throw new Error(`Template slot "${name}" is not filled`);
      return value;
    }
  );
  return {
    ...template,
    script,
    slots,
    host: host ?? template.host,
    beats: template.beats,
  };
}

// ---------------------------------------------------------------------------
// Beat plan
// ---------------------------------------------------------------------------

export interface PlannedVisual extends BeatVisual {
  start: number;
  end: number;
}

export interface PlannedBeat {
  id: string;
  margot: MargotLayout;
  start: number;
  end: number;
  visual?: PlannedVisual;
}

export function planBeats(
  beats: BeatSpec[],
  anchors: Record<string, WordSpan>,
  timings: WordTiming[]
): PlannedBeat[] {
  const at = (index: number, label: string): WordTiming => {
    const w = timings[index];
    if (!w) throw new Error(`${label}: word ${index} does not exist`);
    return w;
  };
  return beats.map(beat => {
    const span = anchors[beat.id];
    if (!span)
      throw new Error(
        `Beat "${beat.id}" has no @{${beat.id}} anchor in the script`
      );
    const planned: PlannedBeat = {
      id: beat.id,
      margot: beat.margot,
      start: at(span.startWord, `Beat ${beat.id}`).start,
      end: at(span.endWord, `Beat ${beat.id}`).end,
    };
    const v = beat.visual;
    if (v) {
      if (!(VISUAL_TYPES as readonly string[]).includes(v.type)) {
        throw new Error(
          `Beat "${beat.id}": visual type "${v.type}" is not allowed. Use real footage, photos or Remotion; never ${v.type} scenery.`
        );
      }
      if (!v.source.trim())
        throw new Error(`Beat "${beat.id}": visual has no source`);
      if (v.endWord < v.startWord) {
        throw new Error(`Beat "${beat.id}": visual ends before it starts`);
      }
      planned.visual = {
        ...v,
        start: at(v.startWord, `Beat ${beat.id} visual`).start,
        end: at(v.endWord, `Beat ${beat.id} visual`).end,
      };
    }
    return planned;
  });
}

export interface BeatPlanCheck {
  ok: boolean;
  totalSeconds: number;
  aloneSeconds: number;
  /** Margot on screen with nothing else to look at, as a share of runtime. */
  aloneShare: number;
  issues: string[];
}

export const MAX_ALONE_SHARE = 0.25;

/**
 * Footage-first rule: Margot on screen alone stays at or under 25% of runtime.
 * A pip or split beat with no visual counts as alone. A beat with Margot off
 * and no visual is an empty screen and fails.
 */
export function checkBeatPlan(
  plan: PlannedBeat[],
  maxAloneShare: number = MAX_ALONE_SHARE
): BeatPlanCheck {
  const issues: string[] = [];
  if (plan.length === 0) {
    return {
      ok: false,
      totalSeconds: 0,
      aloneSeconds: 0,
      aloneShare: 0,
      issues: ['Plan has no beats'],
    };
  }
  const totalSeconds =
    Math.max(...plan.map(b => b.end)) - Math.min(...plan.map(b => b.start));
  let aloneSeconds = 0;
  const byStart = [...plan].sort((a, b) => a.start - b.start);
  for (let i = 1; i < byStart.length; i += 1) {
    if (byStart[i].start < byStart[i - 1].end - 1e-9) {
      issues.push(
        `Beat "${byStart[i].id}" overlaps beat "${byStart[i - 1].id}"`
      );
    }
  }
  for (const beat of plan) {
    const length = beat.end - beat.start;
    const covered = beat.visual
      ? Math.max(
          0,
          Math.min(beat.end, beat.visual.end) -
            Math.max(beat.start, beat.visual.start)
        )
      : 0;
    if (beat.margot === 'off') {
      if (covered < length - 1e-9) {
        issues.push(
          `Beat "${beat.id}": Margot is off screen but no visual covers the whole beat`
        );
      }
      continue;
    }
    if ((beat.margot === 'pip' || beat.margot === 'split') && !beat.visual) {
      issues.push(`Beat "${beat.id}": ${beat.margot} layout needs a visual`);
    }
    aloneSeconds += length - covered;
  }
  const aloneShare = totalSeconds > 0 ? aloneSeconds / totalSeconds : 1;
  if (aloneShare > maxAloneShare + 1e-9) {
    issues.push(
      `Margot is alone on screen for ${(aloneShare * 100).toFixed(0)}% of the runtime; the limit is ${(maxAloneShare * 100).toFixed(0)}%`
    );
  }
  return {
    ok: issues.length === 0,
    totalSeconds,
    aloneSeconds,
    aloneShare,
    issues,
  };
}

/**
 * Beats must point at anchors that exist, must not overlap, and together must
 * cover every spoken word, so no stretch of the runtime is left without screen
 * instructions. Used before any paid call.
 */
export function assertBeatsMatchScript(
  beats: BeatSpec[],
  script: AnchoredScript
): void {
  const spans: { id: string; span: WordSpan }[] = [];
  for (const beat of beats) {
    const span = Object.prototype.hasOwnProperty.call(script.anchors, beat.id)
      ? script.anchors[beat.id]
      : undefined;
    if (!span) {
      throw new Error(
        `Beat "${beat.id}" has no @{${beat.id}} anchor in the script`
      );
    }
    spans.push({ id: beat.id, span });
  }
  spans.sort((a, b) => a.span.startWord - b.span.startWord);
  let next = 0;
  for (const { id, span } of spans) {
    if (span.startWord < next) {
      throw new Error(`Beat "${id}" overlaps the previous beat`);
    }
    if (span.startWord > next) {
      throw new Error(
        `Words ${next} to ${span.startWord - 1} are not covered by any beat`
      );
    }
    next = span.endWord + 1;
  }
  if (next < script.words.length) {
    throw new Error(
      `Words ${next} to ${script.words.length - 1} are not covered by any beat`
    );
  }
}
