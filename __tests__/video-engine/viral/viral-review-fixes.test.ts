/**
 * Regression tests for the first independent review round (P1 uncovered
 * runtime, plus the cheap P2 items). Each was written to fail before the fix.
 */
import { parseAnchoredScript } from '@/lib/video/viral/anchored-script';
import {
  buildCaptionCues,
  scheduleCues,
  toAss,
} from '@/lib/video/viral/karaoke-captions';
import {
  assertBeatsMatchScript,
  checkBeatPlan,
  type BeatSpec,
  type PlannedBeat,
  type ViralFormatTemplate,
} from '@/lib/video/viral/format-template';
import { buildMargotShort } from '@/lib/video/viral/margot-short';
import { charactersToWords } from '@/lib/video/viral/word-timing';

const photo = (s: number, e: number) => ({
  type: 'job-photo' as const,
  source: 'p.jpg',
  startWord: s,
  endWord: e,
});

describe('P1: the beat plan must cover the whole script', () => {
  it('rejects beats that leave spoken words outside any beat', () => {
    const script = parseAnchoredScript('one two @{a}three@{/a} four five');
    const beats: BeatSpec[] = [{ id: 'a', margot: 'off', visual: photo(2, 2) }];
    expect(() => assertBeatsMatchScript(beats, script)).toThrow(/not covered/);
  });

  it('accepts beats that tile every word', () => {
    const script = parseAnchoredScript('@{a}one two@{/a} @{b}three@{/b}');
    const beats: BeatSpec[] = [
      { id: 'a', margot: 'off', visual: photo(0, 1) },
      { id: 'b', margot: 'off', visual: photo(2, 2) },
    ];
    expect(() => assertBeatsMatchScript(beats, script)).not.toThrow();
  });

  it('rejects overlapping beats', () => {
    const script = parseAnchoredScript('@{a}one @{b}two@{/b} three@{/a}');
    const beats: BeatSpec[] = [
      { id: 'a', margot: 'off', visual: photo(0, 2) },
      { id: 'b', margot: 'off', visual: photo(1, 1) },
    ];
    expect(() => assertBeatsMatchScript(beats, script)).toThrow(/overlap/);
  });

  it('plan check rejects overlapping beat windows instead of double counting', () => {
    const plan: PlannedBeat[] = [
      { id: 'a', margot: 'full', start: 0, end: 4 },
      { id: 'b', margot: 'full', start: 2, end: 6 },
    ];
    const r = checkBeatPlan(plan);
    expect(r.ok).toBe(false);
    expect(r.issues.join(' ')).toMatch(/overlap/);
  });
});

describe('P2 fixes', () => {
  it('lets an anchor be named after an Object prototype property', () => {
    const p = parseAnchoredScript('@{constructor}word@{/constructor}');
    expect(p.anchors.constructor).toEqual({ startWord: 0, endWord: 0 });
  });

  it('strips emoji from caption text', () => {
    const ass = toAss(
      scheduleCues(
        buildCaptionCues(
          [
            {
              index: 0,
              text: 'hello\u{1F525}',
              start: 0,
              end: 1,
              estimated: false,
            },
          ],
          [0]
        )
      )
    );
    expect(ass).toContain('hello');
    expect(ass).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('does not sweep the highlight through silence before a word', () => {
    const ass = toAss(
      scheduleCues(
        buildCaptionCues(
          [
            { index: 0, text: 'Hello', start: 1, end: 2, estimated: false },
            { index: 1, text: 'again', start: 4, end: 5, estimated: false },
          ],
          [0]
        )
      )
    );
    expect(ass).toMatch(/\{\\k200\}\{\\kf100\}again/);
  });

  it('rejects empty timestamp evidence', () => {
    expect(() =>
      charactersToWords({
        characters: [],
        character_start_times_seconds: [],
        character_end_times_seconds: [],
      })
    ).toThrow(/no timestamps/);
  });

  it('rejects non-finite timestamps', () => {
    expect(() =>
      charactersToWords({
        characters: ['a'],
        character_start_times_seconds: [Number.NaN],
        character_end_times_seconds: [1],
      })
    ).toThrow(/finite/);
  });
});

describe('buildMargotShort: no stand-in voice through an empty audio URL', () => {
  const env = {
    MARGOT_ELEVENLABS_VOICE_ID: 'voice-m',
    MARGOT_HEYGEN_AVATAR_ID: 'avatar-m',
  };
  const template: ViralFormatTemplate = {
    id: 't',
    script: '@{a}Water damage starts.@{/a}',
    slots: {},
    host: 'margot',
    beats: [{ id: 'a', margot: 'off', visual: photo(0, 2) }],
  };
  const spoken = 'Water damage starts.';
  const chars = spoken.split('');
  const alignment = {
    characters: chars,
    character_start_times_seconds: chars.map((_, i) => i * 0.05),
    character_end_times_seconds: chars.map((_, i) => i * 0.05 + 0.05),
  };
  const consent = {
    subjectName: 'Margot',
    sourceRef: 't',
    confirmedAt: '2026-10-24',
  };

  it('stops before HeyGen when the uploaded audio URL is empty', async () => {
    const createAvatarVideo = jest.fn();
    await expect(
      buildMargotShort(
        { template, env, consent },
        {
          speak: jest.fn().mockResolvedValue({
            success: true,
            audioBase64: 'AAA',
            alignment,
          }),
          uploadAudio: jest.fn().mockResolvedValue(''),
          heygen: { createAvatarVideo },
        }
      )
    ).rejects.toThrow(/audio url/i);
    expect(createAvatarVideo).not.toHaveBeenCalled();
  });

  it('stops before any provider call when beats leave words uncovered', async () => {
    const speak = jest.fn();
    await expect(
      buildMargotShort(
        {
          template: {
            ...template,
            script: 'lead in @{a}Water damage starts.@{/a}',
          },
          env,
          consent,
        },
        {
          speak,
          uploadAudio: jest.fn(),
          heygen: { createAvatarVideo: jest.fn() },
        }
      )
    ).rejects.toThrow(/not covered/);
    expect(speak).not.toHaveBeenCalled();
  });
});
