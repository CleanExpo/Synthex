/**
 * Review round 3: audio that runs past the last script word is still runtime,
 * and missing consent must stop the run before any paid call.
 */
import { planBeats } from '@/lib/video/viral/format-template';
import { buildMargotShort } from '@/lib/video/viral/margot-short';

describe('the plan runs to the end of the audio', () => {
  it('ends the last beat at audioEnd when the voice says more than the script', () => {
    const plan = planBeats(
      [
        {
          id: 'a',
          margot: 'off',
          visual: { type: 'stock', source: 's', startWord: 0, endWord: 0 },
        },
      ],
      { a: { startWord: 0, endWord: 0 } },
      [{ index: 0, text: 'hello', start: 0, end: 1, estimated: false }],
      100
    );
    expect(plan[0].end).toBe(100);
    expect(plan[0].visual?.end).toBe(100);
  });
});

describe('buildMargotShort guards', () => {
  const env = {
    MARGOT_ELEVENLABS_VOICE_ID: 'voice-m',
    MARGOT_HEYGEN_AVATAR_ID: 'avatar-m',
  };
  const template = {
    id: 't',
    script: '@{a}hello@{/a}',
    slots: {},
    host: 'margot',
    beats: [
      {
        id: 'a',
        margot: 'off' as const,
        visual: {
          type: 'stock' as const,
          source: 's',
          startWord: 0,
          endWord: 0,
        },
      },
    ],
  };
  const speech = 'hello goodbye';
  const chars = speech.split('');
  const alignment = {
    characters: chars,
    character_start_times_seconds: chars.map((_, i) => i * 0.1),
    character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.1),
  };

  it('refuses to spend on ElevenLabs when HeyGen consent is missing', async () => {
    const speak = jest.fn();
    await expect(
      buildMargotShort(
        { template, env, consent: null },
        {
          speak,
          uploadAudio: jest.fn(),
          heygen: { createAvatarVideo: jest.fn() },
        }
      )
    ).rejects.toThrow(/consent/i);
    expect(speak).not.toHaveBeenCalled();
  });

  it('charges the manifest for the whole audio, including words past the script', async () => {
    const r = await buildMargotShort(
      {
        template,
        env,
        consent: { subjectName: 'Margot', sourceRef: 't', confirmedAt: 'x' },
      },
      {
        speak: jest
          .fn()
          .mockResolvedValue({ success: true, audioBase64: 'A', alignment }),
        uploadAudio: jest.fn().mockResolvedValue('https://example.test/a.mp3'),
        heygen: {
          createAvatarVideo: jest.fn().mockResolvedValue({
            id: 'j',
            provider: 'heygen',
            status: 'mocked',
          }),
        },
      }
    );
    expect(r.manifest.steps[1].units).toBeCloseTo(1.3, 1);
    expect(r.plan[r.plan.length - 1].end).toBeCloseTo(1.3, 1);
  });
});
