/**
 * Motion Studio — planner.
 *
 * Deterministic: turns a validated brief into beats for the MotionStudio
 * composition (16:9, 9:16 or 1:1), using only the brief's own words. The
 * language model's job (in the operator skill) is to fill the brief; this
 * module decides what is allowed on screen and refuses what is not.
 */
import { COMPOSITION_REGISTRY } from '@/lib/remotion/registry';
import type { MotionBeat, MotionStudioProps } from '@/lib/remotion/types';
import { MOTION_PLACEMENTS, type MotionBrief } from './brief';
import { checkFigures, type FactCheck } from './fact-guard';
import { MIN_LABEL_PX, type HouseStyle } from './house-style';

const COMPOSITION_FOR_ASPECT = {
  '16:9': 'MotionStudio',
  '9:16': 'MotionStudioPortrait',
  '1:1': 'MotionStudioSquare',
} as const;

/** Muted feeds are read, not heard: keep each on-screen line short. */
/** RoboNuggets guide: never more than 6 words on screen at once in a feed. */
export const MAX_WORDS_MUTED = 6;
export const MAX_WORDS_WITH_SOUND = 10;
export const FPS = 30;

export interface MotionPlan {
  compositionId: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  props: MotionStudioProps;
  onScreen: string[];
  factCheck: FactCheck;
  /** Blocking problems; a plan with issues must not render. */
  issues: string[];
  /** Worth knowing, not blocking. */
  warnings: string[];
  /** Frames to inspect: one still per second (Claude Motion's self-critique). */
  critiqueFrames: number[];
}

type WithoutDuration<T> = T extends unknown
  ? Omit<T, 'durationInFrames'>
  : never;
type Draft = WithoutDuration<MotionBeat> & { weight: number };

/** Content beats in reading order; numbers on list items are ordinals, not claims. */
function contentBeats(brief: MotionBrief): {
  beats: Draft[];
  onScreen: string[];
} {
  const c = brief.content;
  switch (c.kind) {
    case 'stat':
      return {
        beats: [
          {
            kind: 'stat',
            value: c.stat,
            label: c.label,
            context: c.context,
            weight: 2,
          },
        ],
        onScreen: [c.stat, c.label, c.context],
      };
    case 'comparison':
      return {
        beats: [
          {
            kind: 'compare',
            oldLabel: 'Before',
            oldText: c.oldWay,
            newLabel: 'After',
            newText: c.newWay,
            weight: 2,
          },
        ],
        onScreen: [c.oldWay, c.newWay],
      };
    case 'case-study':
      return {
        beats: [
          { kind: 'headline', text: c.challenge, weight: 1 },
          { kind: 'headline', text: c.solution, weight: 1 },
          c.metric
            ? { kind: 'stat', value: c.metric, label: c.result, weight: 1.5 }
            : { kind: 'headline', text: c.result, weight: 1 },
        ] as Draft[],
        onScreen: [
          c.challenge,
          c.solution,
          c.result,
          ...(c.metric ? [c.metric] : []),
        ],
      };
    case 'how-to':
      return {
        beats: c.steps.map(
          (s, i) =>
            ({
              kind: 'item',
              index: String(i + 1),
              text: s.step,
              weight: 1,
            }) as Draft
        ),
        onScreen: c.steps.flatMap(s => [
          s.step,
          ...(s.detail ? [s.detail] : []),
        ]),
      };
    case 'list':
      return {
        beats: c.items.map(
          (text, i) =>
            ({ kind: 'item', index: String(i + 1), text, weight: 1 }) as Draft
        ),
        onScreen: c.items,
      };
    case 'explainer':
      return {
        beats: c.scenes.map(
          s => ({ kind: 'headline', text: s.text, weight: 1 }) as Draft
        ),
        onScreen: c.scenes.flatMap(s => [
          s.text,
          ...(s.subtitle ? [s.subtitle] : []),
        ]),
      };
  }
}

export function planMotion(brief: MotionBrief, style: HouseStyle): MotionPlan {
  const placement = MOTION_PLACEMENTS[brief.placement];
  const issues: string[] = [];
  const warnings: string[] = [];
  const compositionId = COMPOSITION_FOR_ASPECT[placement.aspect];
  const meta = COMPOSITION_REGISTRY.find(m => m.id === compositionId)!;
  const durationInFrames = brief.durationSeconds * FPS;

  const body = contentBeats(brief);
  const drafts: Draft[] = [
    { kind: 'headline', text: brief.headline, weight: 1 },
    ...body.beats,
    { kind: 'cta', text: brief.cta, weight: 1.2 },
  ];
  const onScreen = [brief.headline, ...body.onScreen, brief.cta];

  // Split the runtime by weight; every beat must be on screen long enough to read.
  const minBeat = Math.max(FPS * 1.5, style.motion.baseFrames * 3);
  const totalWeight = drafts.reduce((n, d) => n + d.weight, 0);
  const beats = drafts.map(({ weight, ...beat }) => ({
    ...beat,
    durationInFrames: Math.floor((durationInFrames * weight) / totalWeight),
  })) as MotionBeat[];
  beats[beats.length - 1].durationInFrames +=
    durationInFrames - beats.reduce((n, b) => n + b.durationInFrames, 0);
  if (beats.some(b => b.durationInFrames < minBeat)) {
    issues.push(
      `Too much for ${brief.durationSeconds}s: each beat needs at least ${(minBeat / FPS).toFixed(1)}s. Lengthen the video or cut points.`
    );
  }

  const maxWords = placement.muted ? MAX_WORDS_MUTED : MAX_WORDS_WITH_SOUND;
  for (const text of onScreen) {
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words > maxWords)
      issues.push(
        `Too long to read on screen (${words} words, max ${maxWords}): "${text}"`
      );
  }

  const factCheck = checkFigures(onScreen, brief.source, brief.derived);
  if (!factCheck.ok)
    issues.push(
      `Figures not found in the source: ${factCheck.unsupported.join(', ')}`
    );

  return {
    compositionId,
    width: meta.width,
    height: meta.height,
    fps: FPS,
    durationInFrames,
    props: {
      title: brief.headline,
      scenes: [],
      brandName: style.displayName,
      brandColour: style.colours.primary,
      durationInFrames,
      beats,
      style: {
        primary: style.colours.primary,
        accent: style.colours.accent,
        background:
          'chromaKey' in placement
            ? placement.chromaKey
            : style.colours.background,
        chromaKey: 'chromaKey' in placement,
        text: style.colours.text,
        displayFont: style.typography.display,
        bodyFont: style.typography.body,
        displayFontSrc: style.typography.displaySrc,
        displayWeight: style.typography.displayWeight,
        bodyFontSrc: style.typography.bodySrc,
        bodyWeight: style.typography.bodyWeight,
        easingIn: style.motion.easingIn,
        signature: style.motion.signature,
        fastFrames: style.motion.fastFrames,
        baseFrames: style.motion.baseFrames,
        minLabelPx: MIN_LABEL_PX,
      },
    },
    onScreen,
    factCheck,
    issues,
    warnings,
    critiqueFrames: Array.from(
      { length: brief.durationSeconds },
      (_, i) => (i + 1) * FPS - 1
    ),
  };
}
