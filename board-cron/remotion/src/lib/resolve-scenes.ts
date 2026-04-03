/**
 * Resolves a BoardScript into frame-timed scenes for Remotion.
 *
 * Audio-driven: if an audio file exists for a scene, its duration sets the
 * scene length. Otherwise, we estimate from word count.
 */
import type {
  BoardScript,
  PersonaManifest,
  ResolvedScene,
  ScriptScene,
} from './types';

const FPS = 30;
const WORDS_PER_MINUTE = 150; // conservative speech rate
const SCENE_PADDING_FRAMES = 30; // 1 second between scenes
const TITLE_DURATION_FRAMES = 5 * FPS; // 5 seconds
const CLOSING_DURATION_FRAMES = 8 * FPS; // 8 seconds

/**
 * Estimate scene duration from content word count.
 * Adds padding for music/sfx tails.
 */
function estimateDurationFrames(scene: ScriptScene): number {
  if (scene.duration_hint_seconds) {
    return scene.duration_hint_seconds * FPS;
  }

  if (!scene.narrated || !scene.content) {
    // Non-narrated scenes (title cards, etc.)
    if (scene.type === 'title_card') return TITLE_DURATION_FRAMES;
    if (scene.type === 'closing') return CLOSING_DURATION_FRAMES;
    return 3 * FPS;
  }

  const wordCount = scene.content.split(/\s+/).length;
  const speechSeconds = (wordCount / WORDS_PER_MINUTE) * 60;
  // Add 1.5s buffer for pacing (breath, dramatic pauses)
  const totalSeconds = speechSeconds + 1.5;
  return Math.ceil(totalSeconds * FPS);
}

/**
 * Resolve all scenes into frame-timed layout with persona data.
 */
export function resolveScenes(
  script: BoardScript,
  personas: PersonaManifest,
): ResolvedScene[] {
  const personaMap = new Map(personas.personas.map((p) => [p.id, p]));
  let currentFrame = 0;

  return script.scenes.map((scene) => {
    const durationFrames = estimateDurationFrames(scene);
    const resolved: ResolvedScene = {
      ...scene,
      startFrame: currentFrame,
      durationFrames,
      persona_entry: scene.persona
        ? personaMap.get(scene.persona)
        : undefined,
    };
    currentFrame += durationFrames + SCENE_PADDING_FRAMES;
    return resolved;
  });
}

/** Total duration of all resolved scenes in frames */
export function totalFrames(scenes: ResolvedScene[]): number {
  if (scenes.length === 0) return 0;
  const last = scenes[scenes.length - 1];
  return last.startFrame + last.durationFrames;
}

export { FPS };
