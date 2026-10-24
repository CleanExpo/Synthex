/**
 * Review round 4: trailing whitespace timestamps are still audio.
 */
import { buildMargotShort } from '@/lib/video/viral/margot-short';

describe('audio end comes from every character timestamp', () => {
  it('plans and meters trailing audio that follows the last spoken word', async () => {
    const chars = [...'a b c d '];
    const alignment = {
      characters: chars,
      character_start_times_seconds: chars.map((_, i) => i * 0.5),
      character_end_times_seconds: chars.map((_, i) =>
        i === 7 ? 4.5 : (i + 1) * 0.5
      ),
    };
    const r = await buildMargotShort(
      {
        template: {
          id: 't',
          script: '@{a}a b c@{/a} @{b}d@{/b}',
          slots: {},
          host: 'margot',
          beats: [
            {
              id: 'a',
              margot: 'off',
              visual: {
                type: 'stock',
                source: 'local.mp4',
                startWord: 0,
                endWord: 2,
              },
            },
            { id: 'b', margot: 'full' },
          ],
        },
        env: {
          MARGOT_ELEVENLABS_VOICE_ID: 'v',
          MARGOT_HEYGEN_AVATAR_ID: 'a',
        },
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
    ).catch((e: Error) => e);
    // Extending the final full-screen beat to 4.5s puts Margot alone for 1.5 of 4.5s.
    expect(r).toBeInstanceOf(Error);
    expect((r as Error).message).toMatch(/alone/);
  });
});
