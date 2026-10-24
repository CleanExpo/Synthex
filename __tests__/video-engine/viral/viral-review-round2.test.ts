/**
 * Regression tests for review round 2: pauses between beats belong to a beat,
 * and the cheap P2 items. Written to fail before the fix.
 */
import {
  toAss,
  scheduleCues,
  buildCaptionCues,
} from '@/lib/video/viral/karaoke-captions';
import { checkBeatPlan, planBeats } from '@/lib/video/viral/format-template';
import {
  charactersToWords,
  timeScriptWords,
} from '@/lib/video/viral/word-timing';

const word = (index: number, start: number, end: number) => ({
  index,
  text: `w${index}`,
  start,
  end,
  estimated: false,
});

describe('P1: silence between beats is part of the runtime', () => {
  // word 0 at 0..1, then a 9 second pause, words 1..3 at 10..13
  const timings = [
    word(0, 0, 1),
    word(1, 10, 11),
    word(2, 11, 12),
    word(3, 12, 13),
  ];
  const anchors = {
    a: { startWord: 0, endWord: 0 },
    b: { startWord: 1, endWord: 3 },
  };

  it('gives the pause to the beat before it, so it counts as planned time', () => {
    const plan = planBeats(
      [
        { id: 'a', margot: 'full' },
        {
          id: 'b',
          margot: 'off',
          visual: { type: 'job-photo', source: 'p', startWord: 1, endWord: 3 },
        },
      ],
      anchors,
      timings
    );
    expect(plan[0]).toMatchObject({ start: 0, end: 10 });
    expect(plan[1]).toMatchObject({ start: 10, end: 13 });
  });

  it('therefore fails the 25 percent check when Margot sits alone through the pause', () => {
    const plan = planBeats(
      [
        { id: 'a', margot: 'full' },
        {
          id: 'b',
          margot: 'off',
          visual: { type: 'job-photo', source: 'p', startWord: 1, endWord: 3 },
        },
      ],
      anchors,
      timings
    );
    expect(checkBeatPlan(plan).ok).toBe(false);
  });

  it('starts the first beat at zero and ends the last at the final word', () => {
    const plan = planBeats(
      [
        {
          id: 'a',
          margot: 'off',
          visual: { type: 'stock', source: 's', startWord: 0, endWord: 0 },
        },
      ],
      { a: { startWord: 0, endWord: 0 } },
      [word(0, 0.5, 1.5)]
    );
    expect(plan[0]).toMatchObject({ start: 0, end: 1.5 });
  });
});

describe('P2 round 2', () => {
  it('rejects evidence with no spoken word', () => {
    expect(() =>
      charactersToWords({
        characters: [' ', '\t'],
        character_start_times_seconds: [0, 0.1],
        character_end_times_seconds: [0.1, 0.2],
      })
    ).toThrow(/no spoken/);
  });

  it('rejects a character that ends before it starts', () => {
    expect(() =>
      charactersToWords({
        characters: ['a'],
        character_start_times_seconds: [2],
        character_end_times_seconds: [1],
      })
    ).toThrow(/before it starts/);
  });

  it('flags a fuzzy split as estimated', () => {
    const t = timeScriptWords(
      [{ index: 0, text: 'rainwater' }],
      [
        { text: 'rain', start: 0, end: 0.5 },
        { text: 'later', start: 1, end: 1.5 },
      ]
    );
    expect(t[0].estimated).toBe(true);
  });

  it('strips flag and keycap emoji from captions', () => {
    const ass = toAss(
      scheduleCues(
        buildCaptionCues(
          [
            {
              index: 0,
              text: 'ok\u{1F1E6}\u{1F1FA}1\u{FE0F}\u{20E3}',
              start: 0,
              end: 1,
              estimated: false,
            },
          ],
          [0]
        )
      )
    );
    expect(ass).not.toMatch(/[\u{1F1E6}-\u{1F1FF}⃣]/u);
  });
});

describe('a visual that spans its whole beat holds through the pause', () => {
  it('lets an off-screen Margot beat pass when the visual covers the pause', () => {
    const timings = [word(0, 0, 1), word(1, 4, 5)];
    const plan = planBeats(
      [
        {
          id: 'a',
          margot: 'off',
          visual: { type: 'stock', source: 's', startWord: 0, endWord: 0 },
        },
        {
          id: 'b',
          margot: 'off',
          visual: { type: 'stock', source: 't', startWord: 1, endWord: 1 },
        },
      ],
      { a: { startWord: 0, endWord: 0 }, b: { startWord: 1, endWord: 1 } },
      timings
    );
    expect(plan[0].visual).toMatchObject({ start: 0, end: 4 });
    expect(checkBeatPlan(plan).ok).toBe(true);
  });
});
