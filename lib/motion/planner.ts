/**
 * Motion Studio — planner.
 *
 * Deterministic: turns a validated brief into props for an existing Remotion
 * composition, using only the brief's own words. The language model's job (in
 * the operator skill) is to fill the brief; this module decides what is
 * allowed on screen and refuses what is not.
 */
import { COMPOSITION_REGISTRY } from '@/lib/remotion/registry';
import type { SceneProps } from '@/lib/remotion/types';
import { MOTION_PLACEMENTS, type MotionBrief, type MotionKind } from './brief';
import { checkFigures, type FactCheck } from './fact-guard';
import type { HouseStyle } from './house-style';

const LANDSCAPE: Record<MotionKind, string> = {
  stat: 'StatReveal',
  comparison: 'ComparisonSlide',
  'case-study': 'CaseStudyVideo',
  'how-to': 'HowToVideo',
  list: 'ListicleVideo',
  explainer: 'ExplainerVideo',
};

/** Portrait has one scene-based composition today; other kinds need a new one. */
const PORTRAIT: Partial<Record<MotionKind, string>> = {
  explainer: 'SocialReel',
  list: 'SocialReel',
  'how-to': 'SocialReel',
};

/** Muted feeds are read, not heard: keep each on-screen line short. */
export const MAX_WORDS_MUTED = 8;
export const MAX_WORDS_WITH_SOUND = 14;

export interface MotionPlan {
  compositionId: string | null;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  props: Record<string, unknown> | null;
  onScreen: string[];
  factCheck: FactCheck;
  /** Blocking problems; a plan with issues must not render. */
  issues: string[];
  /** Worth knowing, not blocking. */
  warnings: string[];
  /** Frames to inspect: one still per second (Claude Motion's self-critique). */
  critiqueFrames: number[];
}

function lines(brief: MotionBrief): {
  title: string;
  onScreen: string[];
  props: Record<string, unknown>;
} {
  const c = brief.content;
  switch (c.kind) {
    case 'stat':
      return {
        title: c.label,
        onScreen: [c.stat, c.label, c.context, brief.cta],
        props: { stat: c.stat, statLabel: c.label, context: c.context },
      };
    case 'comparison':
      return {
        title: 'Old way vs new way',
        onScreen: [c.oldWay, c.newWay, brief.cta],
        props: { oldWay: c.oldWay, newWay: c.newWay },
      };
    case 'case-study':
      return {
        title: 'Case study',
        onScreen: [
          c.challenge,
          c.solution,
          c.result,
          ...(c.metric ? [c.metric] : []),
          brief.cta,
        ],
        props: {
          challenge: c.challenge,
          solution: c.solution,
          result: c.result,
          ...(c.metric ? { metric: c.metric } : {}),
        },
      };
    case 'how-to':
      return {
        title: 'How it works',
        onScreen: [
          ...c.steps.flatMap(s => [s.step, ...(s.detail ? [s.detail] : [])]),
          brief.cta,
        ],
        props: { steps: c.steps },
      };
    case 'list':
      return {
        title: 'What matters',
        onScreen: [...c.items, brief.cta],
        props: { items: c.items },
      };
    case 'explainer':
      return {
        title: c.scenes[0].text,
        onScreen: [
          ...c.scenes.flatMap(s => [
            s.text,
            ...(s.subtitle ? [s.subtitle] : []),
          ]),
          brief.cta,
        ],
        props: {},
      };
  }
}

function sceneList(
  brief: MotionBrief,
  fps: number,
  totalFrames: number
): SceneProps[] {
  const c = brief.content;
  const texts: { text: string; subtitle?: string }[] =
    c.kind === 'explainer'
      ? c.scenes.map(s => ({ text: s.text, subtitle: s.subtitle }))
      : c.kind === 'list'
        ? c.items.map(text => ({ text }))
        : c.kind === 'how-to'
          ? c.steps.map(s => ({ text: s.step, subtitle: s.detail }))
          : [];
  const all = [...texts, { text: brief.cta }];
  const each = Math.max(fps, Math.floor(totalFrames / all.length));
  return all.map(s => ({
    text: s.text,
    ...(s.subtitle ? { subtitle: s.subtitle } : {}),
    duration: each,
  }));
}

export function planMotion(brief: MotionBrief, style: HouseStyle): MotionPlan {
  const placement = MOTION_PLACEMENTS[brief.placement];
  const kind = brief.content.kind;
  const issues: string[] = [];
  const warnings: string[] = [];

  const compositionId =
    placement.aspect === '16:9'
      ? LANDSCAPE[kind]
      : placement.aspect === '9:16'
        ? (PORTRAIT[kind] ?? null)
        : null;
  if (!compositionId) {
    issues.push(
      `No ${placement.aspect} composition exists for "${kind}" yet. Use a 16:9 placement or build one with remotion-composition-builder.`
    );
  }
  const meta = COMPOSITION_REGISTRY.find(m => m.id === compositionId);
  const fps = meta?.fps ?? 30;
  const durationInFrames =
    meta?.durationInFrames ?? brief.durationSeconds * fps;
  const fixedSeconds = durationInFrames / fps;
  if (
    meta &&
    Math.abs(fixedSeconds - brief.durationSeconds) / brief.durationSeconds >
      0.25
  ) {
    warnings.push(
      `${meta.id} runs ${fixedSeconds}s; the brief asked for ${brief.durationSeconds}s.`
    );
  }

  const { title, onScreen, props } = lines(brief);
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

  const critiqueFrames = Array.from(
    { length: Math.floor(durationInFrames / fps) },
    (_, i) => (i + 1) * fps - 1
  );

  return {
    compositionId,
    width: meta?.width ?? 1920,
    height: meta?.height ?? 1080,
    fps,
    durationInFrames,
    props: compositionId
      ? {
          title,
          scenes: sceneList(brief, fps, durationInFrames),
          brandColour: style.colours.primary,
          ...props,
        }
      : null,
    onScreen,
    factCheck,
    issues,
    warnings,
    critiqueFrames,
  };
}
