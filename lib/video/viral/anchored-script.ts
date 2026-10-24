/**
 * Anchored script: cue breaks and beat anchors written inline in the script.
 *
 * Adapted from Hypit (hypit-ai/hypit, modified Apache 2.0), commit e26d914.
 * Idea from packages/script (the `||` cue break and `@{id}...@{/id}` span
 * grammar seen in examples/ranking-football/*.svml). Only that subset is
 * ported. Beats attach to words, not seconds, so rewriting a line re-flows timing.
 *
 *   Water damage || starts @{wet}quietly.@{/wet}
 */
import type { ScriptWord } from './word-timing';

export interface WordSpan {
  startWord: number;
  /** Inclusive. */
  endWord: number;
}

export interface AnchoredScript {
  words: ScriptWord[];
  /** Word indices where a new caption cue starts (always includes 0). */
  cueStarts: number[];
  anchors: Record<string, WordSpan>;
  /** The script as spoken: no markup. */
  spokenText: string;
}

const TOKEN = /(\|\||@\{\/?[A-Za-z0-9_-]+\})/;

export function parseAnchoredScript(source: string): AnchoredScript {
  const words: ScriptWord[] = [];
  const cueStarts: number[] = [0];
  const open = new Map<string, number>();
  const anchors: Record<string, WordSpan> = {};

  for (const part of source.split(TOKEN)) {
    if (part === '||') {
      if (
        words.length > 0 &&
        cueStarts[cueStarts.length - 1] !== words.length
      ) {
        cueStarts.push(words.length);
      }
      continue;
    }
    const tag = /^@\{(\/?)([A-Za-z0-9_-]+)\}$/.exec(part);
    if (tag) {
      const [, closing, id] = tag;
      if (!closing) {
        if (open.has(id) || anchors[id])
          throw new Error(`Anchor "${id}" is opened twice`);
        open.set(id, words.length);
      } else {
        const start = open.get(id);
        if (start === undefined)
          throw new Error(`Anchor "${id}" is closed but never opened`);
        if (words.length === start)
          throw new Error(`Anchor "${id}" contains no words`);
        anchors[id] = { startWord: start, endWord: words.length - 1 };
        open.delete(id);
      }
      continue;
    }
    for (const text of part.split(/\s+/).filter(Boolean)) {
      words.push({ index: words.length, text });
    }
  }
  if (open.size > 0) {
    throw new Error(`Anchor "${[...open.keys()][0]}" is never closed`);
  }
  return {
    words,
    cueStarts,
    anchors,
    spokenText: words.map(w => w.text).join(' '),
  };
}
