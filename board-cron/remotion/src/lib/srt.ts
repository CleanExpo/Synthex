/**
 * Deterministic SRT caption generation from resolved scenes.
 *
 * SYN-500 Phase 4a — "burned-in captions". Two burn-in paths are supported:
 *   1. In-composition overlay (see BoardSessionShort's <CaptionBand>), and
 *   2. ffmpeg post-render subtitle burn using the .srt produced here.
 *
 * When real ElevenLabs word-level timestamps are available they should drive
 * cue boundaries; absent that (the default, un-gated path) cues are spread
 * evenly across each narrated scene's frame span. Pure + testable — no audio
 * decoding or external services required.
 */
import type { ResolvedScene } from './types';

export interface SrtCue {
  index: number;
  startFrame: number;
  endFrame: number;
  text: string;
}

/** Max words per on-screen caption line — readable at a glance on mobile. */
const WORDS_PER_CUE = 7;

/** Split a scene's content into <= WORDS_PER_CUE word chunks. */
function chunkWords(content: string, wordsPerCue = WORDS_PER_CUE): string[] {
  const words = content.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerCue) {
    chunks.push(words.slice(i, i + wordsPerCue).join(' '));
  }
  return chunks;
}

/**
 * Build ordered caption cues from resolved (narrated) scenes. Each narrated
 * scene is chunked into short lines spread evenly across its frame span.
 */
export function buildCaptionCues(scenes: ResolvedScene[]): SrtCue[] {
  const cues: SrtCue[] = [];
  let index = 1;

  for (const scene of scenes) {
    if (!scene.narrated || !scene.content) continue;
    const chunks = chunkWords(scene.content);
    if (chunks.length === 0) continue;

    const span = scene.durationFrames;
    const per = span / chunks.length;
    chunks.forEach((text, i) => {
      const startFrame = Math.round(scene.startFrame + i * per);
      const endFrame = Math.round(scene.startFrame + (i + 1) * per);
      cues.push({ index: index++, startFrame, endFrame, text });
    });
  }

  return cues;
}

/** Format a frame number as an SRT timestamp (HH:MM:SS,mmm). */
export function framesToSrtTimestamp(frame: number, fps: number): string {
  const totalMs = Math.max(0, Math.round((frame / fps) * 1000));
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/**
 * Render resolved scenes to a full SRT document ready for ffmpeg
 * `-vf subtitles=captions.srt` burn-in.
 */
export function buildSrt(scenes: ResolvedScene[], fps: number): string {
  const cues = buildCaptionCues(scenes);
  return cues
    .map(cue => {
      const start = framesToSrtTimestamp(cue.startFrame, fps);
      const end = framesToSrtTimestamp(cue.endFrame, fps);
      return `${cue.index}\n${start} --> ${end}\n${cue.text}\n`;
    })
    .join('\n');
}

/** Return the active caption text for a given frame, or null between cues. */
export function captionAtFrame(cues: SrtCue[], frame: number): string | null {
  const cue = cues.find(c => frame >= c.startFrame && frame < c.endFrame);
  return cue ? cue.text : null;
}
