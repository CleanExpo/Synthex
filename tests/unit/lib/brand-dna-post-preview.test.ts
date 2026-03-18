import { generateInstantPostPreview } from '@/lib/brand-dna/post-preview';

describe('generateInstantPostPreview', () => {
  it('returns a non-empty string given minimal business info', async () => {
    const result = await generateInstantPostPreview({
      businessName: "Jake's Café",
      industry: 'café',
      heroCopy: 'Best coffee in Melbourne',
    });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(20);
  });

  it('falls back gracefully when AI key is missing', async () => {
    const original = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const result = await generateInstantPostPreview({
      businessName: 'Test Biz',
      industry: 'retail',
      heroCopy: '',
    });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    process.env.OPENROUTER_API_KEY = original;
  });
});
