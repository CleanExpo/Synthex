/**
 * Short-form (9:16 portrait) scene resolution for the BoardSessionShort cut.
 *
 * SYN-500 Phase 4a. The vertical short re-uses the SAME long-form scenes but
 * keeps only the payoff beats and re-times them to the platform-native
 * 45–60s Reel/Short budget:
 *
 *   Scene 6  — The Decision   (`decision` + `decision_body`) ...... ≤ 30s
 *   Scene 8  — Next Actions   (`next_actions`) .................... ≤ 20s
 *   Scene 10 — Closing CTA    (`closing`) ......................... ≤  8s
 *
 * Timing is derived deterministically from the resolved long-form scenes
 * (audio/word-count driven), then capped to the per-beat vertical budget and
 * re-based to frame 0 so the short is a standalone clip. No external services
 * are required — this is pure, testable logic.
 */
import { FPS, resolveScenes } from './resolve-scenes';
import type {
  BoardScript,
  PersonaManifest,
  ResolvedScene,
  ScriptScene,
} from './types';

/** Scene types kept in the vertical short cut, in narrative order. */
export const SHORT_FORM_SCENE_TYPES: ReadonlySet<ScriptScene['type']> = new Set(
  ['decision', 'decision_body', 'next_actions', 'closing']
);

/** Tighter 0.5s gap between beats for a fast vertical cut. */
const SHORT_PADDING_FRAMES = Math.round(0.5 * FPS);

/**
 * Per-beat maximum duration (frames) for the vertical cut. Long-form beats
 * (e.g. a 200-word decision body) are capped so the whole short stays within
 * the 45–60s Reel/Short budget. A beat shorter than its cap keeps its natural
 * length.
 */
const SHORT_FORM_CAP_FRAMES: Partial<Record<ScriptScene['type'], number>> = {
  decision: 5 * FPS,
  decision_body: 25 * FPS,
  next_actions: 20 * FPS,
  closing: 8 * FPS,
};

/**
 * Take a fully-resolved long-form scene list and return the vertical short
 * subset — filtered to the payoff beats, per-beat-capped, and re-based to
 * frame 0.
 */
export function selectShortFormScenes(
  resolved: ResolvedScene[]
): ResolvedScene[] {
  const kept = resolved.filter(s => SHORT_FORM_SCENE_TYPES.has(s.type));

  let currentFrame = 0;
  return kept.map(scene => {
    const cap = SHORT_FORM_CAP_FRAMES[scene.type];
    const durationFrames =
      cap !== undefined
        ? Math.min(scene.durationFrames, cap)
        : scene.durationFrames;
    const rebased: ResolvedScene = {
      ...scene,
      startFrame: currentFrame,
      durationFrames,
    };
    currentFrame += durationFrames + SHORT_PADDING_FRAMES;
    return rebased;
  });
}

/** Resolve a board script directly into vertical short scenes. */
export function resolveShortFormScenes(
  script: BoardScript,
  personas: PersonaManifest
): ResolvedScene[] {
  return selectShortFormScenes(resolveScenes(script, personas));
}

/** Total duration of the short cut in frames. */
export function shortFormTotalFrames(scenes: ResolvedScene[]): number {
  if (scenes.length === 0) return 0;
  const last = scenes[scenes.length - 1];
  return last.startFrame + last.durationFrames;
}
