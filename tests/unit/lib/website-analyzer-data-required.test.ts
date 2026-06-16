/**
 * SYN-1022 — honesty layer: missing facts are recorded as DATA_REQUIRED,
 * never fabricated. Forces the total-scrape-failure path (no Firecrawl key,
 * native fetch rejects) and asserts the result is honest about unknowns.
 */
import { analyzeWebsite } from '@/lib/ai/website-analyzer';

describe('analyzeWebsite — DATA_REQUIRED (SYN-1022)', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.FIRECRAWL_API_KEY;

  beforeEach(() => {
    delete process.env.FIRECRAWL_API_KEY; // skip Firecrawl tier
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = originalKey;
    jest.restoreAllMocks();
  });

  it('records unknown fields and fabricates nothing when scraping fails', async () => {
    const result = await analyzeWebsite({
      url: 'https://example.com',
      businessName: 'Acme Co',
    });

    expect(result).not.toBeNull();
    expect(result!.confidence).toBe(0);

    // No fabricated brand colour (was '#f59e0b' before SYN-1022)
    expect(result!.brandColors.primary).toBe('');

    // Every undeterminable field is explicitly recorded, not guessed
    expect(result!.dataRequired).toEqual(
      expect.arrayContaining([
        'industry',
        'description',
        'brandColors.primary',
        'logo',
        'keyTopics',
        'targetAudience',
        'socialHandles',
      ])
    );

    // Persona falling back to the user-supplied name is acceptable (not a fabricated fact)
    expect(result!.suggestedPersonaName).toBe('Acme Co');
  });
});
