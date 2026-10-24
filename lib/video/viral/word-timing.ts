/**
 * Word timing: match the script's words to the words ElevenLabs actually spoke.
 *
 * Adapted from Hypit (hypit-ai/hypit, modified Apache 2.0), commit e26d914.
 * Source: packages/narrative-speech-alignment/src/align.ts and normalize.ts.
 * Changes: no Hypit graph types, seconds instead of frames, plus a converter
 * from ElevenLabs character timestamps to spoken-word evidence.
 */

export interface ScriptWord {
  index: number;
  text: string;
}

export interface EvidenceWord {
  text: string;
  start: number;
  end: number;
}

export interface WordTiming {
  index: number;
  text: string;
  start: number;
  end: number;
  /** True when the time was interpolated or inferred from a fuzzy match. */
  estimated: boolean;
}

export type AlignmentRelation =
  | 'exact'
  | 'split'
  | 'merge'
  | 'replacement'
  | 'source-omission'
  | 'evidence-insertion';

export interface AlignmentGroup {
  sourceStart: number;
  sourceEnd: number; // exclusive
  evidenceStart: number;
  evidenceEnd: number; // exclusive
  relation: AlignmentRelation;
  cost: number;
}

/** ElevenLabs /with-timestamps alignment block. */
export interface CharacterAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

const EPSILON = 1e-9;
const MAX_GROUP = 4;
const OMISSION_COST = 0.5;
const INSERTION_COST = 0.35;

export function normalizeForAlignment(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '');
}

function editDistance(left: string[], right: string[]): number {
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let l = 0; l < left.length; l += 1) {
    const current = [l + 1];
    for (let r = 0; r < right.length; r += 1) {
      current.push(
        Math.min(
          previous[r + 1] + 1,
          current[r] + 1,
          previous[r] + (left[l] === right[r] ? 0 : 1)
        )
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function joined(texts: string[]): string {
  return texts.map(normalizeForAlignment).join('');
}

function relationOf(s: number, e: number, exact: boolean): AlignmentRelation {
  if (s === 0) return 'evidence-insertion';
  if (e === 0) return 'source-omission';
  if (s === 1 && e === 1 && exact) return 'exact';
  if (s > 1 && e === 1) return 'merge';
  if (s === 1 && e > 1) return 'split';
  return 'replacement';
}

function pairedCost(source: string[], evidence: string[]): number {
  const a = joined(source);
  const b = joined(evidence);
  if (a === b) return source.length === 1 && evidence.length === 1 ? 0 : 0.055;
  const width = Math.max([...a].length, [...b].length, 1);
  const distance = editDistance([...a], [...b]) / width;
  const grouping = 0.055 * Math.max(0, source.length + evidence.length - 2);
  return distance + grouping;
}

interface Cell {
  cost: number;
  exact: number;
  prevS: number;
  prevE: number;
  group: AlignmentGroup;
}

function better(c: Cell, cur: Cell | undefined): boolean {
  if (!cur) return true;
  if (c.cost < cur.cost - EPSILON) return true;
  if (c.cost > cur.cost + EPSILON) return false;
  return c.exact > cur.exact;
}

/** Group script words against spoken words at least total cost. */
export function alignWordGroups(
  source: string[],
  evidence: string[]
): AlignmentGroup[] {
  const sn = source.map(normalizeForAlignment);
  const en = evidence.map(normalizeForAlignment);

  // Fast path: identical wording, one unambiguous zero-cost path.
  if (sn.length === en.length && sn.every((t, i) => t === en[i])) {
    return sn.map((_, i) => ({
      sourceStart: i,
      sourceEnd: i + 1,
      evidenceStart: i,
      evidenceEnd: i + 1,
      relation: 'exact' as const,
      cost: 0,
    }));
  }

  const rows: (Cell | undefined)[][] = Array.from(
    { length: source.length + 1 },
    () => Array<Cell | undefined>(evidence.length + 1).fill(undefined)
  );
  rows[0][0] = {
    cost: 0,
    exact: 0,
    prevS: -1,
    prevE: -1,
    group: {
      sourceStart: 0,
      sourceEnd: 0,
      evidenceStart: 0,
      evidenceEnd: 0,
      relation: 'exact',
      cost: 0,
    },
  };

  const relax = (
    si: number,
    ei: number,
    ns: number,
    ne: number,
    group: AlignmentGroup,
    exact: number
  ): void => {
    const prev = rows[si][ei];
    if (!prev) return;
    const origin = si === 0 && ei === 0;
    const cand: Cell = {
      cost: (origin ? 0 : prev.cost) + group.cost,
      exact: (origin ? 0 : prev.exact) + exact,
      prevS: si,
      prevE: ei,
      group,
    };
    if (better(cand, rows[ns][ne])) rows[ns][ne] = cand;
  };

  for (let si = 0; si <= source.length; si += 1) {
    for (let ei = 0; ei <= evidence.length; ei += 1) {
      if (!rows[si][ei]) continue;
      for (let sc = 1; sc <= MAX_GROUP && si + sc <= source.length; sc += 1) {
        for (
          let ec = 1;
          ec <= MAX_GROUP && ei + ec <= evidence.length;
          ec += 1
        ) {
          const exact = sc === 1 && ec === 1 && sn[si] === en[ei];
          relax(
            si,
            ei,
            si + sc,
            ei + ec,
            {
              sourceStart: si,
              sourceEnd: si + sc,
              evidenceStart: ei,
              evidenceEnd: ei + ec,
              relation: relationOf(sc, ec, exact),
              cost: pairedCost(
                source.slice(si, si + sc),
                evidence.slice(ei, ei + ec)
              ),
            },
            exact ? 1 : 0
          );
        }
      }
      if (si < source.length) {
        relax(
          si,
          ei,
          si + 1,
          ei,
          {
            sourceStart: si,
            sourceEnd: si + 1,
            evidenceStart: ei,
            evidenceEnd: ei,
            relation: 'source-omission',
            cost: OMISSION_COST,
          },
          0
        );
      }
      if (ei < evidence.length) {
        relax(
          si,
          ei,
          si,
          ei + 1,
          {
            sourceStart: si,
            sourceEnd: si,
            evidenceStart: ei,
            evidenceEnd: ei + 1,
            relation: 'evidence-insertion',
            cost: INSERTION_COST,
          },
          0
        );
      }
    }
  }

  const groups: AlignmentGroup[] = [];
  let s = source.length;
  let e = evidence.length;
  while (s > 0 || e > 0) {
    const cell = rows[s][e];
    if (!cell)
      throw new Error('Word alignment failed to produce a complete path.');
    groups.push(cell.group);
    s = cell.prevS;
    e = cell.prevE;
  }
  return groups.reverse();
}

/** Turn ElevenLabs per-character timestamps into spoken words. */
export function charactersToWords(a: CharacterAlignment): EvidenceWord[] {
  const n = a.characters.length;
  if (
    a.character_start_times_seconds.length !== n ||
    a.character_end_times_seconds.length !== n
  ) {
    throw new Error('Character alignment arrays differ in length');
  }
  if (n === 0) throw new Error('Character alignment has no timestamps');
  for (let i = 0; i < n; i += 1) {
    if (
      !Number.isFinite(a.character_start_times_seconds[i]) ||
      !Number.isFinite(a.character_end_times_seconds[i])
    ) {
      throw new Error(`Character alignment time at ${i} is not finite`);
    }
    if (a.character_end_times_seconds[i] < a.character_start_times_seconds[i]) {
      throw new Error(`Character ${i} ends before it starts`);
    }
  }
  const words: EvidenceWord[] = [];
  let text = '';
  let start = 0;
  let end = 0;
  for (let i = 0; i < n; i += 1) {
    if (/\s/.test(a.characters[i])) {
      if (text) words.push({ text, start, end });
      text = '';
      continue;
    }
    if (!text) start = a.character_start_times_seconds[i];
    text += a.characters[i];
    end = a.character_end_times_seconds[i];
  }
  if (text) words.push({ text, start, end });
  if (words.length === 0) {
    throw new Error('Character alignment has no spoken word');
  }
  return words;
}

/**
 * Give every script word a time window. Words the voice did not speak are
 * interpolated and flagged estimated, never silently dropped.
 */
export function timeScriptWords(
  script: ScriptWord[],
  evidence: EvidenceWord[]
): WordTiming[] {
  const groups = alignWordGroups(
    script.map(w => w.text),
    evidence.map(w => w.text)
  );
  const out: WordTiming[] = [];
  let cursor = 0;
  for (const g of groups) {
    const count = g.sourceEnd - g.sourceStart;
    if (count === 0) continue;
    if (g.evidenceEnd === g.evidenceStart) {
      for (let i = g.sourceStart; i < g.sourceEnd; i += 1) {
        out.push({
          index: i,
          text: script[i].text,
          start: cursor,
          end: cursor,
          estimated: true,
        });
      }
      continue;
    }
    const start = evidence[g.evidenceStart].start;
    const end = evidence[g.evidenceEnd - 1].end;
    const weights = script
      .slice(g.sourceStart, g.sourceEnd)
      .map(w => Math.max(1, normalizeForAlignment(w.text).length));
    const total = weights.reduce((a, b) => a + b, 0);
    let t = start;
    for (let k = 0; k < count; k += 1) {
      const next =
        k === count - 1 ? end : t + ((end - start) * weights[k]) / total;
      out.push({
        index: g.sourceStart + k,
        text: script[g.sourceStart + k].text,
        start: t,
        end: next,
        estimated:
          g.relation === 'replacement' ||
          g.relation === 'merge' ||
          g.cost > 0.06,
      });
      t = next;
    }
    cursor = end;
  }
  // Give omitted words a short window so captions and beats can still place them.
  for (let i = 0; i < out.length; i += 1) {
    if (out[i].estimated && out[i].start === out[i].end) {
      const t = out[i].start;
      const nextReal = out.slice(i + 1).find(w => w.end > w.start);
      out[i] = {
        ...out[i],
        end: nextReal ? Math.min(nextReal.start, t + 0.2) : t + 0.2,
      };
    }
  }
  return out;
}
