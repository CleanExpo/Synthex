/**
 * SYN-584 — DataForSEO AI Overview fetcher.
 *
 * The load-bearing property is the one the dependency gate exists to protect:
 * a failed or unconfigured read must NEVER be indistinguishable from a real
 * read that found nothing. Several tests below assert exactly that distinction.
 */
import {
  createDataForSeoAiOverviewFetcher,
  extractAiOverviewText,
} from '@/lib/geo-citation/dataforseo-ai-overview-fetcher';
import { AI_OVERVIEW_NOT_CONFIGURED_REASON } from '@/lib/geo-citation/ai-overview-adapter';

const LOGIN = 'DATAFORSEO_LOGIN';
const PASSWORD = 'DATAFORSEO_PASSWORD';

const okPayload = (items: unknown[]) => ({
  tasks: [{ status_code: 20000, result: [{ items }] }],
});

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response;

describe('extractAiOverviewText', () => {
  it('reads the markdown form', () => {
    expect(
      extractAiOverviewText(
        okPayload([
          { type: 'organic', title: 'x' },
          { type: 'ai_overview', markdown: 'Restoration in Brisbane...' },
        ])
      )
    ).toBe('Restoration in Brisbane...');
  });

  it('falls back to text, then to joined sub-items', () => {
    expect(
      extractAiOverviewText(okPayload([{ type: 'ai_overview', text: 'plain' }]))
    ).toBe('plain');
    expect(
      extractAiOverviewText(
        okPayload([
          { type: 'ai_overview', items: [{ text: 'a' }, { text: 'b' }] },
        ])
      )
    ).toBe('a\nb');
  });

  it('returns null when the SERP genuinely has no AI Overview block', () => {
    expect(extractAiOverviewText(okPayload([{ type: 'organic' }]))).toBeNull();
  });

  it('does not mistake whitespace for content', () => {
    expect(
      extractAiOverviewText(
        okPayload([{ type: 'ai_overview', markdown: '   ' }])
      )
    ).toBeNull();
  });

  it('survives malformed payloads without throwing', () => {
    for (const bad of [
      null,
      undefined,
      {},
      { tasks: null },
      { tasks: [] },
      { tasks: [{}] },
      { tasks: [{ result: [{}] }] },
    ]) {
      expect(() => extractAiOverviewText(bad)).not.toThrow();
      expect(extractAiOverviewText(bad)).toBeNull();
    }
  });
});

describe('createDataForSeoAiOverviewFetcher', () => {
  const original = {
    login: process.env[LOGIN],
    password: process.env[PASSWORD],
  };
  afterEach(() => {
    if (original.login === undefined) delete process.env[LOGIN];
    else process.env[LOGIN] = original.login;
    if (original.password === undefined) delete process.env[PASSWORD];
    else process.env[PASSWORD] = original.password;
  });

  it('reports not-configured and makes NO network call without credentials', async () => {
    delete process.env[LOGIN];
    delete process.env[PASSWORD];
    const fetchImpl = jest.fn();
    const result = await createDataForSeoAiOverviewFetcher({
      fetchImpl: fetchImpl as never,
    })('q');
    expect(result.configured).toBe(false);
    expect(result.rawText).toBeNull();
    expect(result.errorReason).toBe(AI_OVERVIEW_NOT_CONFIGURED_REASON);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('treats a half-set credential pair as not configured', async () => {
    process.env[LOGIN] = 'user@example.com';
    delete process.env[PASSWORD];
    const fetchImpl = jest.fn();
    const result = await createDataForSeoAiOverviewFetcher({
      fetchImpl: fetchImpl as never,
    })('q');
    expect(result.configured).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns the AI Overview text when configured', async () => {
    process.env[LOGIN] = 'user@example.com';
    process.env[PASSWORD] = 'secret';
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          okPayload([{ type: 'ai_overview', markdown: 'Synthex is cited.' }])
        )
      );
    const result = await createDataForSeoAiOverviewFetcher({
      fetchImpl: fetchImpl as never,
    })('q');
    expect(result).toMatchObject({
      configured: true,
      rawText: 'Synthex is cited.',
      errorReason: null,
      statusCode: 200,
    });
  });

  it('DISTINGUISHES "asked, none present" from "could not ask"', async () => {
    process.env[LOGIN] = 'user@example.com';
    process.env[PASSWORD] = 'secret';
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(okPayload([{ type: 'organic' }])));
    const asked = await createDataForSeoAiOverviewFetcher({
      fetchImpl: fetchImpl as never,
    })('q');
    // Both have rawText null. Only errorReason separates them, so the monitor
    // must be able to rely on it.
    expect(asked.configured).toBe(true);
    expect(asked.rawText).toBeNull();
    expect(asked.errorReason).toBeNull();

    delete process.env[LOGIN];
    const couldNotAsk = await createDataForSeoAiOverviewFetcher({
      fetchImpl: fetchImpl as never,
    })('q');
    expect(couldNotAsk.rawText).toBeNull();
    expect(couldNotAsk.errorReason).not.toBeNull();
    expect(couldNotAsk.configured).toBe(false);
  });

  it('surfaces 429 so the monitor backoff can react', async () => {
    process.env[LOGIN] = 'user@example.com';
    process.env[PASSWORD] = 'secret';
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}, 429));
    const result = await createDataForSeoAiOverviewFetcher({
      fetchImpl: fetchImpl as never,
    })('q');
    expect(result.statusCode).toBe(429);
    expect(result.rawText).toBeNull();
    expect(result.errorReason).toContain('429');
  });

  it('reports a non-20000 task status as an error, not as an empty result', async () => {
    process.env[LOGIN] = 'user@example.com';
    process.env[PASSWORD] = 'secret';
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({
          tasks: [{ status_code: 40501, status_message: 'Invalid Field' }],
        })
      );
    const result = await createDataForSeoAiOverviewFetcher({
      fetchImpl: fetchImpl as never,
    })('q');
    expect(result.rawText).toBeNull();
    expect(result.errorReason).toContain('40501');
  });

  it('never throws when the network fails; it reports', async () => {
    process.env[LOGIN] = 'user@example.com';
    process.env[PASSWORD] = 'secret';
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const result = await createDataForSeoAiOverviewFetcher({
      fetchImpl: fetchImpl as never,
    })('q');
    expect(result.configured).toBe(true);
    expect(result.rawText).toBeNull();
    expect(result.errorReason).toContain('ECONNRESET');
  });

  it('sends Basic auth and the query, and does not leak the password into the body', async () => {
    process.env[LOGIN] = 'user@example.com';
    process.env[PASSWORD] = 'secret';
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(okPayload([])));
    await createDataForSeoAiOverviewFetcher({ fetchImpl: fetchImpl as never })(
      'brisbane mould'
    );
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('api.dataforseo.com');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('user@example.com:secret').toString('base64')}`
    );
    expect(init.body).toContain('brisbane mould');
    expect(init.body).not.toContain('secret');
  });
});
