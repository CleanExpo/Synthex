/**
 * SYN-1404: time CCW shots and captions to Margot's voiceover, using the
 * ElevenLabs with-timestamps character alignment.
 */

import type { CcwShot } from './shot-plans';

export const CCW_VIDEO_SECONDS = 30;

export type CcwAlignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

export function wordsFromAlignment(text: string, a: CcwAlignment) {
  const words: { text: string; from: number; to: number }[] = [];
  let start = -1;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === ' ') {
      if (start >= 0) {
        words.push({
          text: text.slice(start, i),
          from: a.character_start_times_seconds[start],
          to: a.character_end_times_seconds[i - 1],
        });
      }
      start = -1;
    } else if (start < 0) start = i;
  }
  return words;
}

/** Each shot starts just before its trigger words; the first starts at 0. */
export function timeShots(text: string, a: CcwAlignment, shots: CcwShot[]) {
  const lower = text.toLowerCase();
  const starts = shots.map((s, i) => {
    if (i === 0) return 0;
    const at = lower.indexOf(s.trigger.toLowerCase());
    if (at < 0) throw new Error(`trigger not spoken: "${s.trigger}"`);
    return Math.max(0, a.character_start_times_seconds[at] - 0.05);
  });
  starts.forEach((t, i) => {
    if (i > 0 && t <= starts[i - 1]) {
      throw new Error(`shot ${i + 1} starts before shot ${i}`);
    }
  });
  return shots.map((s, i) => ({
    ...s,
    from: starts[i],
    to: i + 1 < shots.length ? starts[i + 1] : CCW_VIDEO_SECONDS,
  }));
}
