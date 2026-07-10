/**
 * Firecrawl evidence adapter — golden fixture tests (SYN-MCP-006).
 *
 * ALL HTTP mocked: @mendable/firecrawl-js is jest-mocked; fixtures are
 * recorded provider responses under tests/unit/evidence/fixtures/.
 */
import { createHash } from 'crypto';
import { createFirecrawlRetriever } from '@/lib/evidence/adapters/firecrawl';
import { RetrieverUnavailableError } from '@/lib/evidence/types';
import searchFixture from './fixtures/firecrawl-search.json';
import scrapeFixture from './fixtures/firecrawl-scrape.json';

const mockSearch = jest.fn();
const mockScrape = jest.fn();

jest.mock('@mendable/firecrawl-js', () => ({
  __esModule: true,
  default: class MockFirecrawlApp {
    search(...args: unknown[]) {
      return mockSearch(...args);
    }
    scrape(...args: unknown[]) {
      return mockScrape(...args);
    }
  },
}));

const sha256 = (text: string) =>
  createHash('sha256').update(text, 'utf8').digest('hex');

describe('firecrawl evidence adapter', () => {
  const ORIGINAL_ENV = process.env.FIRECRAWL_API_KEY;

  beforeEach(() => {
    process.env.FIRECRAWL_API_KEY = 'test-firecrawl-key';
    mockSearch.mockResolvedValue(searchFixture);
    mockScrape.mockResolvedValue(scrapeFixture);
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = ORIGINAL_ENV;
  });

  it('declares search + fetch capabilities', () => {
    const retriever = createFirecrawlRetriever();
    expect(retriever.id).toBe('firecrawl');
    expect(retriever.capabilities).toEqual({ canSearch: true, canFetch: true });
  });

  it('available() reflects FIRECRAWL_API_KEY presence', () => {
    const retriever = createFirecrawlRetriever();
    expect(retriever.available()).toBe(true);
    delete process.env.FIRECRAWL_API_KEY;
    expect(retriever.available()).toBe(false);
  });

  it('throws RetrieverUnavailableError when key is missing', async () => {
    delete process.env.FIRECRAWL_API_KEY;
    const retriever = createFirecrawlRetriever();
    await expect(retriever.search('any query')).rejects.toThrow(
      RetrieverUnavailableError
    );
  });

  describe('search — golden fixture → normalized SourceEvidence', () => {
    it('normalizes provider rows and filters unsafe/malformed ones', async () => {
      const retriever = createFirecrawlRetriever();
      const results = await retriever.search('acme drying claim');

      // 4 fixture rows: 1 private-IP URL filtered (SSRF), 1 missing URL skipped.
      expect(results).toHaveLength(2);

      const first = results[0];
      expect(first).toMatchObject({
        url: 'https://www.industry-journal.com/reports/acme-water-damage-2026',
        title: 'Acme Restoration cuts water damage drying time by 40%',
        publishedAt: null, // search results carry no publish date
        provider: 'firecrawl',
        domain: 'industry-journal.com', // www. stripped
      });
      expect(first.excerpt).toContain('Independent field study');
      expect(first.retrievedAt).toEqual(expect.any(String));
      expect(Number.isNaN(Date.parse(first.retrievedAt))).toBe(false);
      // Deterministic content hash over url + title + excerpt
      expect(first.contentHash).toBe(
        sha256(`${first.url}\n${first.title}\n${first.excerpt}`)
      );

      expect(results[1].domain).toBe('standards-body.org');
    });

    it('passes the caller limit through (clamped) to the provider', async () => {
      const retriever = createFirecrawlRetriever();
      await retriever.search('q', { limit: 3 });
      expect(mockSearch).toHaveBeenCalledWith(
        'q',
        expect.objectContaining({ limit: 3 })
      );
      await retriever.search('q', { limit: 999 });
      expect(mockSearch).toHaveBeenLastCalledWith(
        'q',
        expect.objectContaining({ limit: 10 })
      );
    });
  });

  describe('fetch — golden fixture → normalized SourceEvidence', () => {
    it('normalizes a scraped document with publish date + content hash', async () => {
      const retriever = createFirecrawlRetriever();
      const evidence = await retriever.fetch(
        'https://www.industry-journal.com/reports/acme-water-damage-2026'
      );

      expect(evidence).not.toBeNull();
      expect(evidence).toMatchObject({
        title: 'Acme Restoration field study 2026',
        publishedAt: '2026-03-15T09:00:00.000Z',
        provider: 'firecrawl',
        domain: 'industry-journal.com',
      });
      expect(evidence!.contentHash).toBe(sha256(scrapeFixture.markdown));
      expect(evidence!.excerpt.length).toBeLessThanOrEqual(2000);
    });

    it('returns null when the provider yields an empty document', async () => {
      mockScrape.mockResolvedValue({ markdown: '', metadata: {} });
      const retriever = createFirecrawlRetriever();
      const evidence = await retriever.fetch('https://example.com/empty');
      expect(evidence).toBeNull();
    });

    it.each([
      'http://localhost:3000/admin',
      'http://127.0.0.1/secrets',
      'http://169.254.169.254/latest/meta-data',
      'http://10.0.0.5/internal',
      'file:///etc/passwd',
      'ftp://example.com/file',
    ])('rejects unsafe URL at the boundary: %s', async url => {
      const retriever = createFirecrawlRetriever();
      await expect(retriever.fetch(url)).rejects.toThrow();
      expect(mockScrape).not.toHaveBeenCalled();
    });
  });
});
