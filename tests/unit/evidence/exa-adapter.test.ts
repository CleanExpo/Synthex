/**
 * Exa evidence adapter — golden fixture tests (SYN-MCP-006).
 *
 * ALL HTTP mocked: the adapter speaks Exa REST via global.fetch (no exa-js —
 * no new dependency), so global.fetch is jest-mocked with recorded fixtures.
 *
 * DORMANCY is the headline behaviour: available() === !!process.env.EXA_API_KEY,
 * and without the key no request is ever attempted.
 */
import { createHash } from 'crypto';
import { createExaRetriever } from '@/lib/evidence/adapters/exa';
import { RetrieverUnavailableError } from '@/lib/evidence/types';
import exaSearchFixture from './fixtures/exa-search.json';
import exaContentsFixture from './fixtures/exa-contents.json';

const sha256 = (text: string) =>
  createHash('sha256').update(text, 'utf8').digest('hex');

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

describe('exa evidence adapter', () => {
  const ORIGINAL_ENV = process.env.EXA_API_KEY;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.EXA_API_KEY = 'test-exa-key';
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.EXA_API_KEY;
    else process.env.EXA_API_KEY = ORIGINAL_ENV;
  });

  it('declares search + fetch capabilities', () => {
    const retriever = createExaRetriever();
    expect(retriever.id).toBe('exa');
    expect(retriever.capabilities).toEqual({ canSearch: true, canFetch: true });
  });

  describe('dormancy — ships dark until EXA_API_KEY is provisioned', () => {
    it('available() is false without the key, true with it', () => {
      const retriever = createExaRetriever();
      expect(retriever.available()).toBe(true);
      delete process.env.EXA_API_KEY;
      expect(retriever.available()).toBe(false);
    });

    it('search() refuses without the key and never touches the network', async () => {
      delete process.env.EXA_API_KEY;
      const retriever = createExaRetriever();
      await expect(retriever.search('acme claim')).rejects.toThrow(
        RetrieverUnavailableError
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fetch() refuses without the key and never touches the network', async () => {
      delete process.env.EXA_API_KEY;
      const retriever = createExaRetriever();
      await expect(
        retriever.fetch(
          'https://www.research-review.net/2026/acme-restoration-study'
        )
      ).rejects.toThrow(RetrieverUnavailableError);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('search — golden fixture → normalized SourceEvidence', () => {
    it('POSTs to /search with the API key header and normalizes results', async () => {
      fetchMock.mockResolvedValue(jsonResponse(exaSearchFixture));
      const retriever = createExaRetriever();
      const results = await retriever.search('acme drying study', { limit: 5 });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.exa.ai/search',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'x-api-key': 'test-exa-key' }),
          body: JSON.stringify({
            query: 'acme drying study',
            numResults: 5,
            contents: { text: true },
          }),
        })
      );

      // 3 fixture results: loopback URL filtered out.
      expect(results).toHaveLength(2);

      const first = results[0];
      expect(first).toMatchObject({
        url: 'https://www.research-review.net/2026/acme-restoration-study',
        title: 'Peer commentary on the Acme Restoration drying study',
        publishedAt: '2026-04-02T00:00:00.000Z', // Exa supplies publish dates
        provider: 'exa',
        domain: 'research-review.net',
      });
      expect(first.contentHash).toBe(
        sha256(exaSearchFixture.results[0].text as string)
      );

      // publishedDate: null flows through as unknown age (policy handles it)
      expect(results[1].publishedAt).toBeNull();
    });
  });

  describe('fetch — golden fixture → normalized SourceEvidence', () => {
    it('POSTs to /contents and normalizes the first result', async () => {
      fetchMock.mockResolvedValue(jsonResponse(exaContentsFixture));
      const retriever = createExaRetriever();
      const evidence = await retriever.fetch(
        'https://www.research-review.net/2026/acme-restoration-study'
      );

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.exa.ai/contents',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            urls: [
              'https://www.research-review.net/2026/acme-restoration-study',
            ],
            text: true,
          }),
        })
      );

      expect(evidence).toMatchObject({
        provider: 'exa',
        publishedAt: '2026-04-02T00:00:00.000Z',
        domain: 'research-review.net',
      });
      expect(evidence!.excerpt).toContain(
        'audited 40% average drying-time reduction'
      );
    });

    it('returns null when /contents yields no results', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ results: [] }));
      const retriever = createExaRetriever();
      const evidence = await retriever.fetch('https://example.com/nothing');
      expect(evidence).toBeNull();
    });

    it('throws on a non-2xx provider response', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: 'rate limited' }, 429));
      const retriever = createExaRetriever();
      await expect(retriever.search('q')).rejects.toThrow(/status 429/);
    });

    it.each([
      'http://localhost/x',
      'http://169.254.169.254/latest',
      'http://[::1]/loopback',
      'javascript:alert(1)',
    ])('rejects unsafe URL at the boundary: %s', async url => {
      const retriever = createExaRetriever();
      await expect(retriever.fetch(url)).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
