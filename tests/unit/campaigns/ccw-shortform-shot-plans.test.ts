/**
 * SYN-1404: the zero-cost CCW shot plans use only owned photos listed in the
 * reference manifest, and every shot starts on words Margot actually says.
 */

import fs from 'node:fs';
import path from 'node:path';
import manifest from '@/public/reference-library/manifest.json';
import { CCW_SHOT_PLANS } from '@/lib/remotion/ccw/shot-plans';
import { timeShots, wordsFromAlignment } from '@/lib/remotion/ccw/timing';

type Subject = { rights?: string; images?: { file: string }[] };
const industries = (
  manifest as unknown as {
    industries: Record<string, { subjects: Record<string, Subject> }>;
  }
).industries;

const ROOT = path.resolve(__dirname, '../../..');

function voiceover(videoId: string): string {
  const t = fs.readFileSync(
    path.join(
      ROOT,
      'docs/campaigns/ccw-2026-11-video/scripts',
      `${videoId}.md`
    ),
    'utf8'
  );
  return t
    .split('## Voiceover')[1]
    .split('## Shot list')[0]
    .split('\n')
    .filter(l => /^\d+\./.test(l))
    .map(l => l.replace(/^\d+\.\s*\([^)]*\)\s*/, '').trim())
    .join(' ');
}

function fakeAlignment(text: string) {
  const chars = text.split('');
  return {
    characters: chars,
    character_start_times_seconds: chars.map((_, i) => i * 0.07),
    character_end_times_seconds: chars.map((_, i) => i * 0.07 + 0.06),
  };
}

describe('SYN-1404 CCW zero-cost shot plans', () => {
  it('covers the week 1 videos built so far', () => {
    expect(CCW_SHOT_PLANS.map(p => p.videoId).sort()).toEqual([
      'ccw-w1-d1-am',
      'ccw-w1-d1-pm',
      'ccw-w1-d2-am',
      'ccw-w1-d2-pm',
      'ccw-w1-d3-am',
      'ccw-w1-d3-pm',
      'ccw-w1-d4-pm',
    ]);
  });

  it('keeps every IICRC / S500 line out of w1-d3-pm until the founder signs it off', () => {
    const plan = CCW_SHOT_PLANS.find(p => p.videoId === 'ccw-w1-d3-pm')!;
    const onScreen = JSON.stringify(plan.shots);
    expect(onScreen).not.toMatch(
      /S500|IICRC|mitigation|water damage standard/i
    );
  });

  it('never uses one photo in more than two shots of a video', () => {
    for (const plan of CCW_SHOT_PLANS) {
      // The two day 1 cuts were built before the rule and stay unchanged.
      if (plan.videoId.startsWith('ccw-w1-d1-')) continue;
      const uses = new Map<string, number>();
      for (const shot of plan.shots)
        for (const rel of new Set(shot.images))
          uses.set(rel, (uses.get(rel) ?? 0) + 1);
      for (const [rel, n] of uses) expect([rel, n <= 2]).toEqual([rel, true]);
    }
  });

  it('places products only from the shot images, never the scene itself', () => {
    for (const plan of CCW_SHOT_PLANS)
      for (const shot of plan.shots)
        for (const u of shot.place ?? []) {
          expect(u.img).toBeGreaterThanOrEqual(1);
          expect(u.img).toBeLessThan(shot.images.length);
        }
  });

  it('uses only owned photos that the manifest lists for the named subject', () => {
    for (const plan of CCW_SHOT_PLANS) {
      for (const shot of plan.shots) {
        const listed = new Set<string>();
        for (const s of shot.subjects) {
          const [ind, key] = s.split('/');
          const subj = industries[ind]?.subjects[key];
          expect(subj?.rights).toBe('owned');
          for (const im of subj?.images ?? []) listed.add(`${ind}/${im.file}`);
        }
        for (const rel of shot.images) {
          expect(listed.has(rel)).toBe(true);
          const file = path.join(ROOT, 'public/reference-library', rel);
          expect(fs.existsSync(file)).toBe(true);
          expect(fs.statSync(file).size).toBeGreaterThan(0);
        }
      }
    }
  });

  it('starts every shot on words that are in the script voiceover, in order', () => {
    for (const plan of CCW_SHOT_PLANS) {
      const text = voiceover(plan.videoId);
      const timed = timeShots(text, fakeAlignment(text), plan.shots);
      expect(timed[0].from).toBe(0);
      const last = timed[timed.length - 1];
      expect(last.to).toBeLessThanOrEqual(30);
      expect(last.to - last.from).toBeLessThanOrEqual(3);
      for (let i = 1; i < timed.length; i++) {
        expect(timed[i].from).toBeGreaterThan(timed[i - 1].from);
        expect(timed[i - 1].to).toBe(timed[i].from);
      }
      expect(timed[timed.length - 1].kind).toBe('end');
    }
  });

  it('refuses a trigger that is not spoken', () => {
    const text = 'Cyclone season opened today.';
    expect(() =>
      timeShots(text, fakeAlignment(text), [
        { trigger: 'x', kind: 'hook', subjects: [], images: [] },
        { trigger: 'never said', kind: 'hero', subjects: [], images: [] },
      ])
    ).toThrow(/trigger not spoken/);
  });

  it('refuses an end card longer than 3 s', () => {
    const text =
      'Cyclone season. See the range at CCW, today, tomorrow and all week long.';
    expect(() =>
      timeShots(text, fakeAlignment(text), [
        { trigger: 'x', kind: 'hook', subjects: [], images: [] },
        { trigger: 'See the range', kind: 'end', subjects: [], images: [] },
      ])
    ).toThrow(/end card would run/);
  });

  it('turns the character alignment into caption words', () => {
    const text = 'Quiet does not mean dry.';
    const w = wordsFromAlignment(text, fakeAlignment(text));
    expect(w.map(x => x.text)).toEqual([
      'Quiet',
      'does',
      'not',
      'mean',
      'dry.',
    ]);
    expect(w[1].from).toBeCloseTo(6 * 0.07);
  });
});
