/**
 * SYN-1404: every claim line we put on screen in a CCW short-form video must
 * rest on a quoted source. The line's words (floor type or kinetic type, not
 * the CTA or the brand) must appear in that video's "Claims and sources"
 * table, in a row whose source cell quotes the source sentence and gives its
 * URL. Added 08/11/2026 after "as much as" reached screen with no source.
 */

import fs from 'node:fs';
import path from 'node:path';
import { CCW_SHOT_PLANS } from '@/lib/remotion/ccw/shot-plans';

const ROOT = path.resolve(__dirname, '../../..');

/**
 * Videos made before this test whose claims tables do not yet map every
 * on-screen line to a quoted source with a URL. Each entry lists the exact
 * lines still unmapped, so a new unsourced line in these videos still fails.
 * Owner: the builder of each video; remove the entry when its table is fixed.
 */
const KNOWN_GAPS: Record<string, string[]> = {
  // Monday 17:30 file (merged v3): the table cites ABC News by URL but does
  // not quote the sentence each line rests on, and the kinetic lines are ours.
  'ccw-w1-d1-pm': [
    '5 TO 8 CYCLONES',
    'AVERAGE 11',
    'QUIET ON PAPER',
    'QLD COAST NEAR NORMAL',
    'ONE SYSTEM SERIOUS DAMAGE',
    'QUIET ON PAPER',
    'Quiet does not mean dry.',
    'Ready for the work.',
    'Load the truck.',
  ],
  // Tuesday 17:30, in progress on 08/11/2026 (another builder): this entry
  // only applies while that plan is in the tree.
  'ccw-w1-d2-pm': ['UNDER TOE-KICKS'],
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

type Row = { claim: string; source: string };

function claimRows(videoId: string): Row[] {
  const file = path.join(
    ROOT,
    'docs/campaigns/ccw-2026-11-video/scripts',
    `${videoId}.md`
  );
  const text = fs.readFileSync(file, 'utf8');
  const section = text.split(/^## Claims and sources\s*$/m)[1];
  if (!section) return [];
  return section
    .split(/^## /m)[0]
    .split('\n')
    .filter(l => l.startsWith('|') && !/^\|\s*-/.test(l))
    .slice(1)
    .map(l => {
      const cells = l.split('|').map(c => c.trim());
      return { claim: cells[1] ?? '', source: cells[2] ?? '' };
    });
}

const QUOTED = /["“][^"”]{8,}["”]/;
const URL_RE = /https?:\/\/\S+/;

/** On-screen claim lines for one plan, with no source in its claims table. */
export function unsourcedLines(
  plan: (typeof CCW_SHOT_PLANS)[number],
  rows: Row[]
): string[] {
  const sourced = rows.filter(
    r => QUOTED.test(r.source) && URL_RE.test(r.source)
  );
  const missing: string[] = [];
  for (const shot of plan.shots) {
    for (const words of [shot.floorLines, shot.kinetic]) {
      if (!words?.length) continue;
      const line = words.join(' ');
      const ok = sourced.some(r => norm(r.claim).includes(norm(line)));
      if (!ok) missing.push(line);
    }
  }
  return missing;
}

describe('SYN-1404 CCW on-screen claims carry a quoted source', () => {
  it.each(CCW_SHOT_PLANS.map(p => [p.videoId, p] as const))(
    '%s: every floor and kinetic line maps to a quoted, linked source',
    (videoId, plan) => {
      const missing = unsourcedLines(plan, claimRows(videoId));
      expect(missing).toEqual(KNOWN_GAPS[videoId] ?? []);
    }
  );

  it('catches a planted unsourced line (the check can fail)', () => {
    const plan = CCW_SHOT_PLANS.find(p => p.videoId === 'ccw-w1-d2-am')!;
    const planted = {
      ...plan,
      shots: [
        ...plan.shots,
        { ...plan.shots[0], floorLines: ['TWICE AS', 'FAST'] },
      ],
    };
    expect(unsourcedLines(planted, claimRows('ccw-w1-d2-am'))).toContain(
      'TWICE AS FAST'
    );
  });
});
