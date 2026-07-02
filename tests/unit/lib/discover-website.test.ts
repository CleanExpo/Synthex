/**
 * SYN-1022 — name-only website discovery. Conservative: one clear winner is
 * 'resolved' (caller confirms before scraping), ambiguity is 'review', and a
 * missing search key degrades to 'unavailable' (ask the user) — never a guess.
 */

const mockSearch = jest.fn();
jest.mock('@mendable/firecrawl-js', () => ({
  __esModule: true,
  default: class {
    search = mockSearch;
  },
}));

import { discoverWebsite } from '@/lib/ai/discover-website';

describe('discoverWebsite (SYN-1022)', () => {
  const originalKey = process.env.FIRECRAWL_API_KEY;

  beforeEach(() => {
    mockSearch.mockReset();
    process.env.FIRECRAWL_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = originalKey;
  });

  it('returns unavailable + DATA_REQUIRED:website when no search key is configured', async () => {
    delete process.env.FIRECRAWL_API_KEY;
    const result = await discoverWebsite('Acme Co');
    expect(result.status).toBe('unavailable');
    expect(result.dataRequired).toContain('website');
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('resolves a single clear winner whose domain matches the name', async () => {
    mockSearch.mockResolvedValue({
      web: [
        { url: 'https://acme.com.au', title: 'Acme Co - Home', description: 'x' },
        { url: 'https://unrelated-directory.example', title: 'Listings', description: 'y' },
      ],
    });
    const result = await discoverWebsite('Acme Co');
    expect(result.status).toBe('resolved');
    expect(result.url).toBe('https://acme.com.au');
  });

  it('returns review with candidates when no single result clearly wins', async () => {
    mockSearch.mockResolvedValue({
      web: [
        { url: 'https://example.org', title: 'Generic page', description: 'a' },
        { url: 'https://sample.net', title: 'Another page', description: 'b' },
      ],
    });
    const result = await discoverWebsite('Zeta Corp');
    expect(result.status).toBe('review');
    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    expect(result.url).toBeUndefined();
  });

  it('filters out social/aggregator hosts from candidates', async () => {
    mockSearch.mockResolvedValue({
      web: [
        { url: 'https://facebook.com/acme', title: 'Acme on Facebook', description: '' },
        { url: 'https://www.linkedin.com/company/acme', title: 'Acme', description: '' },
        { url: 'https://acme.com.au', title: 'Acme Co', description: '' },
      ],
    });
    const result = await discoverWebsite('Acme Co');
    // Exact host comparison (www stripped) — no substring matching, which CodeQL
    // flags as incomplete URL sanitization.
    const hosts = result.candidates.map(c =>
      new URL(c.url).hostname.replace(/^www\./, '')
    );
    expect(hosts).not.toContain('facebook.com');
    expect(hosts).not.toContain('linkedin.com');
    expect(hosts).toContain('acme.com.au');
  });
});
