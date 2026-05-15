/**
 * Tests for SYN-826 FAQPage schema emitter (lib/aeo/faq-schema.ts).
 */

import { buildFaqSchema } from '@/lib/aeo/faq-schema';

describe('buildFaqSchema (SYN-826)', () => {
  it('emits FAQPage JSON-LD when every answer passes the gate', async () => {
    const result = await buildFaqSchema({
      brand: 'dr',
      pageUrl: 'https://disasterrecovery.com.au/faq',
      qas: [
        {
          question: 'How long does a typical Cat-1 dryout take?',
          answer: 'Three to five days. Drying logs confirm the result.',
        },
        {
          question: 'Is the work IICRC standard?',
          answer: 'Yes. Every job follows S500 documentation.',
        },
      ],
    });

    expect(result.safe).toBe(true);
    expect(result.jsonLd).toBeTruthy();
    const jsonLd = result.jsonLd as Record<string, unknown>;
    expect(jsonLd['@type']).toBe('FAQPage');
    expect(Array.isArray(jsonLd.mainEntity)).toBe(true);
  });

  it('refuses to emit when any answer fails the gate', async () => {
    const result = await buildFaqSchema({
      brand: 'dr',
      pageUrl: 'https://disasterrecovery.com.au/faq',
      qas: [
        {
          question: 'Why us?',
          answer: 'We deliver world-class results every time.',
        },
      ],
    });

    expect(result.safe).toBe(false);
    expect(result.jsonLd).toBeNull();
    expect(result.perAnswerGate[0].pass).toBe(false);
  });

  it('returns null for empty input', async () => {
    const result = await buildFaqSchema({
      brand: 'dr',
      pageUrl: 'https://disasterrecovery.com.au/faq',
      qas: [],
    });
    expect(result.safe).toBe(false);
    expect(result.jsonLd).toBeNull();
  });
});
