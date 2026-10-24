/**
 * Word-timed karaoke captions, written as an ASS subtitle file for ffmpeg.
 *
 * Adapted from Hypit (hypit-ai/hypit, modified Apache 2.0), commit e26d914.
 * Source: packages/caption-fine/src/schedule.ts (lead and tail envelope and
 * the "cut" handoff). Hypit draws captions in headless Chromium; here the
 * render is an ASS file burned with `ffmpeg -vf ass=...`, so no browser is
 * needed. Captions are code-rendered text, never model-generated.
 */
import type { WordTiming } from './word-timing';

export interface CaptionCue {
  id: string;
  words: WordTiming[];
}

export interface ScheduledCue extends CaptionCue {
  spokenStart: number;
  spokenEnd: number;
  visibleStart: number;
  visibleEnd: number;
}

export interface ScheduleOptions {
  /** Seconds a cue appears before its first word. */
  leadSec?: number;
  /** Seconds a cue lingers after its last word. */
  tailSec?: number;
  /** "cut" ends a cue where the next begins; "overlap" lets them cross. */
  handoff?: 'cut' | 'overlap';
}

export function buildCaptionCues(
  timings: WordTiming[],
  cueStarts: number[]
): CaptionCue[] {
  const starts = [...new Set([0, ...cueStarts])].sort((a, b) => a - b);
  const cues: CaptionCue[] = [];
  starts.forEach((from, i) => {
    const to = i + 1 < starts.length ? starts[i + 1] : timings.length;
    const words = timings.slice(from, to);
    if (words.length) cues.push({ id: `cue-${i + 1}`, words });
  });
  return cues;
}

export function scheduleCues(
  cues: CaptionCue[],
  options: ScheduleOptions = {}
): ScheduledCue[] {
  const lead = options.leadSec ?? 0.08;
  const tail = options.tailSec ?? 0.4;
  const handoff = options.handoff ?? 'cut';
  const out: ScheduledCue[] = cues.map(cue => {
    const spokenStart = Math.min(...cue.words.map(w => w.start));
    const spokenEnd = Math.max(...cue.words.map(w => w.end));
    return {
      ...cue,
      spokenStart,
      spokenEnd,
      visibleStart: Math.max(0, spokenStart - lead),
      visibleEnd: spokenEnd + tail,
    };
  });
  out.sort((a, b) => a.spokenStart - b.spokenStart);
  if (handoff === 'cut') {
    for (let i = 1; i < out.length; i += 1) {
      const prev = out[i - 1];
      const cur = out[i];
      if (prev.spokenEnd <= cur.spokenStart) {
        // Never shorten spoken time; only trim the lingering envelope.
        const end = Math.max(
          prev.spokenEnd,
          Math.min(prev.visibleEnd, cur.spokenStart)
        );
        prev.visibleEnd = end;
        cur.visibleStart = Math.min(
          cur.spokenStart,
          Math.max(cur.visibleStart, end)
        );
      }
    }
  }
  return out;
}

export interface AssStyle {
  fontName: string;
  fontSize: number;
  /** ASS &HAABBGGRR colours. */
  primary: string;
  secondary: string;
  outline: string;
  playResX: number;
  playResY: number;
  marginV: number;
}

export const DEFAULT_ASS_STYLE: AssStyle = {
  fontName: 'Arial',
  fontSize: 64,
  primary: '&H0000D7FF', // sung (already spoken) words
  secondary: '&H00FFFFFF', // words still to come
  outline: '&H00000000',
  playResX: 1080,
  playResY: 1920,
  marginV: 420,
};

function assTime(seconds: number): string {
  const cs = Math.round(Math.max(0, seconds) * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
}

/** Script text must never open an ASS override block or break a line. */
function escapeAssText(text: string): string {
  return text
    .replace(
      /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3|\p{Emoji_Modifier}|\u200d|\ufe0f/gu,
      ''
    )
    .replace(/[{}\\]/g, '')
    .replace(/[\r\n]+/g, ' ');
}

export function toAss(
  cues: ScheduledCue[],
  style: Partial<AssStyle> = {}
): string {
  const s = { ...DEFAULT_ASS_STYLE, ...style };
  const lines = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${s.playResX}`,
    `PlayResY: ${s.playResY}`,
    'WrapStyle: 0',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Karaoke,${s.fontName},${s.fontSize},${s.primary},${s.secondary},${s.outline},&H64000000,-1,0,0,0,100,100,0,0,1,4,1,2,60,60,${s.marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  for (const cue of scheduled(cues)) {
    let cursor = cue.visibleStart;
    const parts: string[] = [];
    for (const w of cue.words) {
      // Silence before a word is a plain delay (\\k), so the sweep starts with the word.
      const gapCs = Math.round(Math.max(0, w.start - cursor) * 100);
      const durCs = Math.round(Math.max(0.01, w.end - w.start) * 100);
      parts.push(
        `${gapCs > 0 ? `{\\k${gapCs}}` : ''}{\\kf${durCs}}${escapeAssText(w.text)}`
      );
      cursor = w.end;
    }
    lines.push(
      `Dialogue: 0,${assTime(cue.visibleStart)},${assTime(cue.visibleEnd)},Karaoke,,0,0,0,,${parts.join(' ')}`
    );
  }
  return `${lines.join('\n')}\n`;
}

function scheduled(cues: ScheduledCue[]): ScheduledCue[] {
  return cues.filter(c => c.words.length > 0 && c.visibleEnd > c.visibleStart);
}
