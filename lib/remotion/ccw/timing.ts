/**
 * SYN-1404: time CCW shots and captions to Margot's voiceover, using the
 * ElevenLabs with-timestamps character alignment.
 */

import type { CcwShot } from './shot-plans';

/** Longest a video may run; the actual length follows the voiceover. */
export const CCW_VIDEO_SECONDS = 30;
/** Phill's review, 08/11/2026: the end card runs 3 s at most. */
export const CCW_END_CARD_MAX_SECONDS = 3;

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
  // The end card holds just past the last spoken word: at least 2.5 s, at
  // most CCW_END_CARD_MAX_SECONDS, and never past CCW_VIDEO_SECONDS.
  const voiceEnd = Math.max(...a.character_end_times_seconds);
  const lastFrom = starts[starts.length - 1];
  // Clamping alone would cut Margot off or leave a flash of end card.
  if (voiceEnd > CCW_VIDEO_SECONDS) {
    throw new Error(
      `voiceover runs ${voiceEnd.toFixed(2)} s; the limit is ${CCW_VIDEO_SECONDS} s`
    );
  }
  if (lastFrom + 2.5 > CCW_VIDEO_SECONDS) {
    throw new Error(
      `last shot starts at ${lastFrom.toFixed(2)} s; it needs 2.5 s before ${CCW_VIDEO_SECONDS} s`
    );
  }
  const end = Math.min(
    CCW_VIDEO_SECONDS,
    Math.max(lastFrom + 2.5, voiceEnd + 0.4)
  );
  if (end - lastFrom > CCW_END_CARD_MAX_SECONDS + 0.05) {
    throw new Error(
      `end card would run ${(end - lastFrom).toFixed(2)} s; start it later in the voiceover`
    );
  }
  return shots.map((s, i) => ({
    ...s,
    from: starts[i],
    to: i + 1 < shots.length ? starts[i + 1] : end,
  }));
}
