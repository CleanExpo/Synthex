/**
 * @jest-environment node
 *
 * Founder decision 16/10/2026: every one of Phill's products narrates with the
 * ElevenLabs voice "Margot". Client brands (e.g. CCW, Bulcs) choose their own;
 * personal brands are not products and keep their own settings.
 */
import { brands } from '@unite-group/brand-config';

const MARGOT = 'tAtHhBlA3E0eKZJKNSKE';

describe('product voice', () => {
  it.each(['dr', 'nrpg', 'carsi', 'ra', 'unite', 'synthex'] as const)(
    '%s uses Margot',
    slug => {
      expect(brands[slug].voiceover.elevenLabsVoiceId).toBe(MARGOT);
    }
  );

  it('no product keeps a placeholder voice id', () => {
    for (const slug of [
      'dr',
      'nrpg',
      'carsi',
      'ra',
      'unite',
      'synthex',
    ] as const) {
      expect(brands[slug].voiceover.elevenLabsVoiceId).toMatch(
        /^[A-Za-z0-9]{20}$/
      );
    }
  });
});
