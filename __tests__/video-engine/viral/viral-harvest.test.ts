/**
 * Tests for the Hypit-derived viral video modules in lib/video/viral.
 * Pure functions plus injected mocks: no ElevenLabs, HeyGen, ffmpeg or network.
 */
import {
  alignWordGroups,
  charactersToWords,
  timeScriptWords,
} from '@/lib/video/viral/word-timing';
import { parseAnchoredScript } from '@/lib/video/viral/anchored-script';
import {
  buildCaptionCues,
  scheduleCues,
  toAss,
} from '@/lib/video/viral/karaoke-captions';
import {
  MargotConfigError,
  checkBeatPlan,
  planBeats,
  resolveMargot,
  swapSlots,
  type ViralFormatTemplate,
} from '@/lib/video/viral/format-template';
import { buildMargotShort } from '@/lib/video/viral/margot-short';

const SCRIPT =
  'Water damage || starts @{wet}quietly. || Thank you for watching,@{/wet} @{dry}then we dry it out.@{/dry}';

function evidenceFor(words: string[], per = 0.4) {
  return words.map((text, i) => ({
    text,
    start: i * per,
    end: i * per + per - 0.05,
  }));
}

describe('word-timing', () => {
  it('aligns identical wording one to one', () => {
    const g = alignWordGroups(['a', 'b'], ['A', 'b.']);
    expect(g.map(x => x.relation)).toEqual(['exact', 'exact']);
  });

  it('handles a split (one script word spoken as two) and an omission', () => {
    const split = alignWordGroups(
      ['rainwater', 'rises'],
      ['rain', 'water', 'rises']
    );
    expect(split[0].relation).toBe('split');
    expect(split[0].evidenceEnd - split[0].evidenceStart).toBe(2);
    const omit = alignWordGroups(['we', 'really', 'dry'], ['we', 'dry']);
    expect(omit.some(x => x.relation === 'source-omission')).toBe(true);
  });

  it('turns ElevenLabs character timestamps into word evidence', () => {
    const chars = 'hi you'.split('');
    const words = charactersToWords({
      characters: chars,
      character_start_times_seconds: chars.map((_, i) => i * 0.1),
      character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.1),
    });
    expect(words.map(w => w.text)).toEqual(['hi', 'you']);
    expect(words[1].start).toBeCloseTo(0.3);
    expect(words[1].end).toBeCloseTo(0.6);
  });

  it('rejects mismatched character arrays instead of guessing', () => {
    expect(() =>
      charactersToWords({
        characters: ['a', 'b'],
        character_start_times_seconds: [0],
        character_end_times_seconds: [0.1, 0.2],
      })
    ).toThrow(/differ in length/);
  });

  it('flags a word the voice did not speak as estimated', () => {
    const script = ['we', 'really', 'dry'].map((text, index) => ({
      index,
      text,
    }));
    const t = timeScriptWords(script, evidenceFor(['we', 'dry']));
    expect(t).toHaveLength(3);
    expect(t[1].estimated).toBe(true);
    expect(t[0].estimated).toBe(false);
  });
});

describe('anchored-script', () => {
  it('parses cue breaks and beat anchors against word positions', () => {
    const p = parseAnchoredScript(SCRIPT);
    expect(p.words.map(w => w.text).join(' ')).toBe(
      'Water damage starts quietly. Thank you for watching, then we dry it out.'
    );
    expect(p.cueStarts).toEqual([0, 2, 4]);
    expect(p.anchors.wet).toEqual({ startWord: 3, endWord: 7 });
    expect(p.anchors.dry).toEqual({ startWord: 8, endWord: 12 });
  });

  it('rejects an anchor that is never closed', () => {
    expect(() => parseAnchoredScript('a @{x}b c')).toThrow(/x/);
  });
});

describe('karaoke captions', () => {
  const p = parseAnchoredScript(SCRIPT);
  const timings = timeScriptWords(
    p.words,
    evidenceFor(p.words.map(w => w.text))
  );

  it('groups words into cues at authored breaks', () => {
    const cues = buildCaptionCues(timings, p.cueStarts);
    expect(cues).toHaveLength(3);
    expect(cues[0].words.map(w => w.text)).toEqual(['Water', 'damage']);
  });

  it('cut handoff stops a cue before the next begins and never shortens spoken time', () => {
    const cues = buildCaptionCues(timings, [0, 2]);
    const sched = scheduleCues(cues, {
      leadSec: 0.1,
      tailSec: 0.5,
      handoff: 'cut',
    });
    expect(sched[0].visibleEnd).toBeLessThanOrEqual(
      sched[1].spokenStart + 1e-9
    );
    expect(sched[0].visibleEnd).toBeGreaterThanOrEqual(sched[0].spokenEnd);
    expect(sched[1].visibleStart).toBeLessThanOrEqual(sched[1].spokenStart);
  });

  it('writes ASS karaoke tags in centiseconds with no emoji', () => {
    const ass = toAss(scheduleCues(buildCaptionCues(timings, p.cueStarts)));
    expect(ass).toContain('[Script Info]');
    expect(ass).toMatch(/\{\\kf?\d+\}Water/);
    expect(ass).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('escapes ASS override characters from the script text', () => {
    const ass = toAss(
      scheduleCues(
        buildCaptionCues(
          [{ index: 0, text: '{\\b1}bad', start: 0, end: 1, estimated: false }],
          [0]
        )
      )
    );
    expect(ass).not.toContain('{\\b1}');
  });
});

describe('Margot default character', () => {
  it('stops when the Margot voice or avatar is not configured (no stand-in voice)', () => {
    expect(() => resolveMargot({})).toThrow(MargotConfigError);
    expect(() => resolveMargot({ MARGOT_ELEVENLABS_VOICE_ID: 'v' })).toThrow(
      /MARGOT_HEYGEN_AVATAR_ID/
    );
  });

  it('reads the voice and avatar from the environment', () => {
    const m = resolveMargot({
      MARGOT_ELEVENLABS_VOICE_ID: 'voice-x',
      MARGOT_HEYGEN_AVATAR_ID: 'avatar-x',
    });
    expect(m).toMatchObject({
      name: 'Margot',
      voiceId: 'voice-x',
      avatarId: 'avatar-x',
    });
  });
});

describe('format template', () => {
  const template: ViralFormatTemplate = {
    id: 'myth-bust',
    script:
      'Everyone says @{claim}{{topic}} is fine.@{/claim} @{truth}It is not.@{/truth}',
    slots: { topic: 'wet carpet' },
    host: 'margot',
    beats: [
      {
        id: 'claim',
        margot: 'pip',
        visual: {
          type: 'job-photo',
          source: 'photos/carpet.jpg',
          startWord: 0,
          endWord: 0,
        },
      },
      { id: 'truth', margot: 'full' },
    ],
  };

  it('swaps topic and host without touching the structure', () => {
    const swapped = swapSlots(template, {
      topic: 'a leaking roof',
      host: 'other',
    });
    expect(swapped.script).toContain('a leaking roof');
    expect(swapped.host).toBe('other');
    expect(swapped.beats).toEqual(template.beats);
    expect(template.script).toContain('{{topic}}');
  });

  it('refuses a template with an unfilled slot', () => {
    expect(() => swapSlots(template, { topic: '' })).toThrow(/topic/);
  });
});

describe('beat plan: show while she tells', () => {
  const words = Array.from({ length: 20 }, (_, i) => ({
    index: i,
    text: `w${i}`,
    start: i,
    end: i + 1,
    estimated: false,
  }));
  const anchors = {
    a: { startWord: 0, endWord: 9 },
    b: { startWord: 10, endWord: 19 },
  };

  it('places a visual on the word-timed window it was given', () => {
    const plan = planBeats(
      [
        {
          id: 'a',
          margot: 'pip',
          visual: {
            type: 'screen-recording',
            source: 'rec/ra.mp4',
            startWord: 2,
            endWord: 5,
          },
        },
        {
          id: 'b',
          margot: 'off',
          visual: {
            type: 'remotion',
            source: 'remotion://stat',
            startWord: 10,
            endWord: 14,
          },
        },
      ],
      anchors,
      words
    );
    expect(plan[0].visual).toMatchObject({ start: 2, end: 6 });
    expect(plan[1].visual).toMatchObject({ start: 10, end: 15 });
    expect(plan[0]).toMatchObject({ start: 0, end: 10 });
  });

  it('fails the check when Margot is alone on screen more than 25 percent', () => {
    const plan = planBeats(
      [
        { id: 'a', margot: 'full' },
        {
          id: 'b',
          margot: 'pip',
          visual: {
            type: 'job-photo',
            source: 'p.jpg',
            startWord: 10,
            endWord: 19,
          },
        },
      ],
      anchors,
      words
    );
    const r = checkBeatPlan(plan);
    expect(r.ok).toBe(false);
    expect(r.aloneShare).toBeCloseTo(0.5);
  });

  it('passes when visuals cover enough of the runtime', () => {
    const plan = planBeats(
      [
        { id: 'a', margot: 'full' },
        {
          id: 'b',
          margot: 'split',
          visual: {
            type: 'stock',
            source: 'stock/x.mp4',
            startWord: 10,
            endWord: 19,
          },
        },
      ],
      { a: { startWord: 0, endWord: 4 }, b: { startWord: 5, endWord: 19 } },
      words
    );
    // beat a alone 5s, beat b alone 5s (visual covers 10..19 only): 10s of 20s
    const r = checkBeatPlan(plan);
    expect(r.aloneShare).toBeCloseTo(10 / 20);
  });

  it('counts a split or picture-in-picture beat with no visual as Margot alone', () => {
    const plan = planBeats(
      [
        { id: 'a', margot: 'pip' },
        {
          id: 'b',
          margot: 'off',
          visual: { type: 'stock', source: 's', startWord: 10, endWord: 19 },
        },
      ],
      anchors,
      words
    );
    expect(checkBeatPlan(plan).aloneShare).toBeCloseTo(0.5);
  });

  it('rejects AI-generated visuals', () => {
    expect(() =>
      planBeats(
        [
          {
            id: 'a',
            margot: 'off',
            visual: {
              type: 'ai-generated' as never,
              source: 'x',
              startWord: 0,
              endWord: 1,
            },
          },
        ],
        anchors,
        words
      )
    ).toThrow(/ai-generated/);
  });

  it('flags an empty screen (Margot off with no visual)', () => {
    const plan = planBeats([{ id: 'a', margot: 'off' }], anchors, words);
    const r = checkBeatPlan(plan);
    expect(r.ok).toBe(false);
    expect(r.issues.join(' ')).toMatch(/a/);
  });
});

describe('buildMargotShort (mocked providers)', () => {
  const env = {
    MARGOT_ELEVENLABS_VOICE_ID: 'voice-m',
    MARGOT_HEYGEN_AVATAR_ID: 'avatar-m',
  };
  const template: ViralFormatTemplate = {
    id: 't',
    script:
      '@{a}Water damage starts quietly.@{/a} @{b}Thank you for watching.@{/b}',
    slots: {},
    host: 'margot',
    beats: [
      {
        id: 'a',
        margot: 'split',
        visual: {
          type: 'job-photo',
          source: 'p.jpg',
          startWord: 0,
          endWord: 3,
        },
      },
      {
        id: 'b',
        margot: 'off',
        visual: {
          type: 'remotion',
          source: 'remotion://x',
          startWord: 4,
          endWord: 7,
        },
      },
    ],
  };
  const spoken = 'Water damage starts quietly. Thank you for watching.';
  const alignment = {
    characters: spoken.split(''),
    character_start_times_seconds: spoken.split('').map((_, i) => i * 0.05),
    character_end_times_seconds: spoken
      .split('')
      .map((_, i) => i * 0.05 + 0.05),
  };
  const consent = {
    subjectName: 'Margot',
    sourceRef: 'test',
    confirmedAt: '2026-10-24',
  };

  function deps() {
    return {
      speak: jest
        .fn()
        .mockResolvedValue({ success: true, audioBase64: 'AAA', alignment }),
      uploadAudio: jest.fn().mockResolvedValue('https://example.test/a.mp3'),
      heygen: {
        createAvatarVideo: jest.fn().mockResolvedValue({
          id: 'job1',
          provider: 'heygen',
          status: 'mocked',
        }),
      },
    };
  }

  it('uses Margot voice and avatar, writes captions, and records a manifest', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch' as never);
    const d = deps();
    const r = await buildMargotShort({ template, env, consent }, d);
    expect(d.speak).toHaveBeenCalledWith(
      expect.objectContaining({ voiceId: 'voice-m' })
    );
    expect(d.heygen.createAvatarVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        avatarId: 'avatar-m',
        audioUrl: 'https://example.test/a.mp3',
      })
    );
    expect(r.ass).toContain('[Events]');
    expect(r.check.ok).toBe(true);
    expect(r.manifest.steps.map(s => s.provider)).toEqual([
      'elevenlabs',
      'heygen',
    ]);
    expect(r.manifest.steps[0].units).toBe(spoken.length);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('stops before any HeyGen render when Margot would be alone too long', async () => {
    const d = deps();
    const bad = {
      ...template,
      beats: [
        { id: 'a', margot: 'full' as const },
        { id: 'b', margot: 'full' as const },
      ],
    };
    await expect(
      buildMargotShort({ template: bad, env, consent }, d)
    ).rejects.toThrow(/alone/);
    expect(d.heygen.createAvatarVideo).not.toHaveBeenCalled();
  });

  it('stops before any provider call when Margot is not configured', async () => {
    const d = deps();
    await expect(
      buildMargotShort({ template, env: {}, consent }, d)
    ).rejects.toThrow(MargotConfigError);
    expect(d.speak).not.toHaveBeenCalled();
  });
});
