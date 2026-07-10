/**
 * Apify evidence adapter — golden fixture tests (SYN-MCP-006).
 *
 * ALL HTTP mocked: the apify-client package is jest-mocked; the adapter goes
 * through the repo's real runActor wrapper (lib/auto-research/apify/client.ts)
 * so the actor-call path is exercised without any network.
 */
import { createHash } from 'crypto';
import {
  createApifyRetriever,
  DEFAULT_APIFY_EVIDENCE_ACTOR,
} from '@/lib/evidence/adapters/apify';
import {
  RetrieverCapabilityError,
  RetrieverUnavailableError,
} from '@/lib/evidence/types';
import actorItemsFixture from './fixtures/apify-actor-items.json';

const mockActorCall = jest.fn();
const mockListItems = jest.fn();

jest.mock('apify-client', () => ({
  ApifyClient: class MockApifyClient {
    actor(actorId: string) {
      return {
        call: (...args: unknown[]) => mockActorCall(actorId, ...args),
      };
    }
    dataset(datasetId: string) {
      return {
        listItems: (...args: unknown[]) => mockListItems(datasetId, ...args),
      };
    }
  },
}));

const sha256 = (text: string) =>
  createHash('sha256').update(text, 'utf8').digest('hex');

describe('apify evidence adapter', () => {
  const ORIGINAL_ENV = process.env.APIFY_API_TOKEN;
  const ORIGINAL_ACTOR = process.env.EVIDENCE_APIFY_ACTOR_ID;

  beforeEach(() => {
    process.env.APIFY_API_TOKEN = 'test-apify-token';
    delete process.env.EVIDENCE_APIFY_ACTOR_ID;
    mockActorCall.mockResolvedValue({
      status: 'SUCCEEDED',
      defaultDatasetId: 'ds-fixture-1',
    });
    mockListItems.mockResolvedValue({ items: actorItemsFixture });
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.APIFY_API_TOKEN;
    else process.env.APIFY_API_TOKEN = ORIGINAL_ENV;
    if (ORIGINAL_ACTOR === undefined)
      delete process.env.EVIDENCE_APIFY_ACTOR_ID;
    else process.env.EVIDENCE_APIFY_ACTOR_ID = ORIGINAL_ACTOR;
  });

  it('declares fetch-only capabilities (Apify cannot web-search)', () => {
    const retriever = createApifyRetriever();
    expect(retriever.id).toBe('apify');
    expect(retriever.capabilities).toEqual({
      canSearch: false,
      canFetch: true,
    });
  });

  it('search() throws RetrieverCapabilityError', async () => {
    const retriever = createApifyRetriever();
    await expect(retriever.search('anything')).rejects.toThrow(
      RetrieverCapabilityError
    );
    expect(mockActorCall).not.toHaveBeenCalled();
  });

  it('available() reflects APIFY_API_TOKEN presence', () => {
    const retriever = createApifyRetriever();
    expect(retriever.available()).toBe(true);
    delete process.env.APIFY_API_TOKEN;
    expect(retriever.available()).toBe(false);
  });

  it('fetch() throws RetrieverUnavailableError without a token', async () => {
    delete process.env.APIFY_API_TOKEN;
    const retriever = createApifyRetriever();
    await expect(
      retriever.fetch('https://trade-press.example.org/articles/x')
    ).rejects.toThrow(RetrieverUnavailableError);
  });

  describe('fetch — golden fixture → normalized SourceEvidence', () => {
    it('runs the default content actor and normalizes the first content item', async () => {
      const retriever = createApifyRetriever();
      const evidence = await retriever.fetch(
        'https://www.trade-press.example.org/articles/acme-drying-protocol'
      );

      expect(mockActorCall).toHaveBeenCalledWith(
        DEFAULT_APIFY_EVIDENCE_ACTOR,
        expect.objectContaining({
          startUrls: [
            {
              url: 'https://www.trade-press.example.org/articles/acme-drying-protocol',
            },
          ],
          maxCrawlPages: 1,
        }),
        expect.anything()
      );

      const item = actorItemsFixture[0];
      expect(evidence).toMatchObject({
        url: item.url,
        title: 'Trade press: Acme drying protocol review',
        publishedAt: '2026-02-01T12:00:00.000Z',
        provider: 'apify',
        domain: 'trade-press.example.org', // www. stripped
      });
      expect(evidence!.contentHash).toBe(sha256(item.text as string));
      expect(evidence!.excerpt).toContain('confirmed the 40% reduction');
    });

    it('honours the EVIDENCE_APIFY_ACTOR_ID env override', async () => {
      process.env.EVIDENCE_APIFY_ACTOR_ID = 'custom/actor';
      const retriever = createApifyRetriever();
      await retriever.fetch('https://trade-press.example.org/articles/x');
      expect(mockActorCall).toHaveBeenCalledWith(
        'custom/actor',
        expect.anything(),
        expect.anything()
      );
    });

    it('returns null when the actor yields no content items', async () => {
      mockListItems.mockResolvedValue({
        items: [{ url: 'https://x.example', text: null }],
      });
      const retriever = createApifyRetriever();
      const evidence = await retriever.fetch(
        'https://trade-press.example.org/empty'
      );
      expect(evidence).toBeNull();
    });

    it('propagates actor failure', async () => {
      mockActorCall.mockResolvedValue({
        status: 'FAILED',
        defaultDatasetId: 'ds-x',
      });
      const retriever = createApifyRetriever();
      await expect(
        retriever.fetch('https://trade-press.example.org/articles/x')
      ).rejects.toThrow(/failed with status/);
    });

    it.each([
      'http://localhost:8080/x',
      'http://192.168.0.1/router',
      'http://[::ffff:169.254.169.254]/metadata',
      'file:///etc/passwd',
    ])('rejects unsafe URL at the boundary: %s', async url => {
      const retriever = createApifyRetriever();
      await expect(retriever.fetch(url)).rejects.toThrow();
      expect(mockActorCall).not.toHaveBeenCalled();
    });
  });
});
