/**
 * SEAM: createBingWebmasterClient (every method) and submitUrlsWithinQuota,
 * with fetch mocked at the network boundary. Catches: wrong JSON endpoint or
 * verb, the {"d": ...} wrapper not unwrapped, a 400 {ErrorCode,Message} or a
 * missing key reported as success, the API key leaking into a result,
 * submissions beyond the daily/monthly quota or the 500-per-batch limit.
 * Misses: live behaviour of ssl.bing.com (no real call; the endpoint shapes
 * come from the Microsoft Learn JSON samples, read 22/10/2026).
 */
import {
  BING_SUBMIT_URL_BATCH_MAX,
  BING_WEBMASTER_JSON_BASE,
  createBingWebmasterClient,
  submitUrlsWithinQuota,
  type BingResult,
} from '@/lib/bing-webmaster';

// Obviously fake fixture key; never a real credential.
const FAKE_KEY = 'FAKE-TEST-KEY-not-a-real-key-0000';

type FetchCall = [string, RequestInit | undefined];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function client(fetchImpl: jest.Mock) {
  return createBingWebmasterClient({
    apiKey: FAKE_KEY,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

/** Fails if the fake key appears anywhere in a result. */
function checkNoKeyLeak(result: unknown): void {
  if (JSON.stringify(result).includes(FAKE_KEY))
    throw new Error('API key leaked into result');
}

describe('Bing Webmaster JSON endpoint shapes', () => {
  it('uses the documented JSON base', () => {
    expect(BING_WEBMASTER_JSON_BASE).toBe(
      'https://ssl.bing.com/webmaster/api.svc/json'
    );
  });

  it('AddSite POSTs {siteUrl}', async () => {
    const f = jest.fn(async () => json(200, { d: null }));
    const r = await client(f).addSite('https://carsi.com.au');
    expect(r.ok).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as FetchCall;
    expect(url.startsWith(`${BING_WEBMASTER_JSON_BASE}/AddSite?apikey=`)).toBe(
      true
    );
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      siteUrl: 'https://carsi.com.au',
    });
  });

  it('GetUserSites GETs and unwraps the site list', async () => {
    const f = jest.fn(async () =>
      json(200, {
        d: [
          {
            __type: 'Site:#Microsoft.Bing.Webmaster.Api',
            AuthenticationCode: 'ABC',
            DnsVerificationCode: 'abc.carsi.com.au',
            IsVerified: false,
            Url: 'https://carsi.com.au',
          },
        ],
      })
    );
    const r = await client(f).getUserSites();
    expect(r).toEqual({
      ok: true,
      data: [
        {
          url: 'https://carsi.com.au',
          isVerified: false,
          authenticationCode: 'ABC',
          dnsVerificationCode: 'abc.carsi.com.au',
        },
      ],
    });
    const [url, init] = f.mock.calls[0] as unknown as FetchCall;
    expect(url.startsWith(`${BING_WEBMASTER_JSON_BASE}/GetUserSites?`)).toBe(
      true
    );
    expect(init?.method).toBe('GET');
  });

  it('VerifySite returns the boolean, and false is not verified', async () => {
    const f = jest.fn(async () => json(200, { d: false }));
    const r = await client(f).verifySite('https://carsi.com.au');
    expect(r).toEqual({ ok: true, data: { verified: false } });
  });

  it('SubmitFeed POSTs {siteUrl, feedUrl}', async () => {
    const f = jest.fn(async () => json(200, { d: null }));
    const r = await client(f).submitFeed(
      'https://carsi.com.au',
      'https://carsi.com.au/sitemap.xml'
    );
    expect(r.ok).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as FetchCall;
    expect(url).toContain('/SubmitFeed?');
    expect(JSON.parse(init?.body as string)).toEqual({
      siteUrl: 'https://carsi.com.au',
      feedUrl: 'https://carsi.com.au/sitemap.xml',
    });
  });

  it('SubmitUrlBatch POSTs {siteUrl, urlList}', async () => {
    const f = jest.fn(async () => json(200, { d: null }));
    const r = await client(f).submitUrlBatch('https://carsi.com.au', [
      'https://carsi.com.au/a',
    ]);
    expect(r.ok).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as FetchCall;
    expect(url).toContain('/SubmitUrlBatch?');
    expect(JSON.parse(init?.body as string)).toEqual({
      siteUrl: 'https://carsi.com.au',
      urlList: ['https://carsi.com.au/a'],
    });
  });

  it('SubmitUrlBatch refuses a batch over 500 without calling', async () => {
    const f = jest.fn(async () => json(200, { d: null }));
    const r = await client(f).submitUrlBatch(
      'https://carsi.com.au',
      Array.from({ length: 501 }, (_, i) => `https://carsi.com.au/${i}`)
    );
    expect(r.ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it('GetUrlSubmissionQuota GETs with siteUrl and unwraps quota', async () => {
    const f = jest.fn(async () =>
      json(200, {
        d: {
          __type: 'UrlSubmissionQuota:#Microsoft.Bing.Webmaster.Api',
          DailyQuota: 5,
          MonthlyQuota: 24,
        },
      })
    );
    const r = await client(f).getUrlSubmissionQuota('https://carsi.com.au');
    expect(r).toEqual({ ok: true, data: { daily: 5, monthly: 24 } });
    const [url] = f.mock.calls[0] as unknown as FetchCall;
    expect(url).toContain('/GetUrlSubmissionQuota?');
    expect(url).toContain(
      `siteUrl=${encodeURIComponent('https://carsi.com.au')}`
    );
  });
});

describe('Bing Webmaster honest failures', () => {
  it('a missing API key is not-configured and makes no call', async () => {
    const f = jest.fn();
    const c = createBingWebmasterClient({
      apiKey: '',
      fetchImpl: f as unknown as typeof fetch,
    });
    const r = await c.addSite('https://carsi.com.au');
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.kind).toBe('not-configured');
    expect(f).not.toHaveBeenCalled();
  });

  it('reads BING_WEBMASTER_API_KEY from env when no key is passed', async () => {
    const prev = process.env.BING_WEBMASTER_API_KEY;
    process.env.BING_WEBMASTER_API_KEY = FAKE_KEY;
    try {
      const f = jest.fn(async () => json(200, { d: null }));
      const c = createBingWebmasterClient({
        fetchImpl: f as unknown as typeof fetch,
      });
      const r = await c.addSite('https://carsi.com.au');
      expect(r.ok).toBe(true);
      const [url] = f.mock.calls[0] as unknown as FetchCall;
      expect(url).toContain(`apikey=${encodeURIComponent(FAKE_KEY)}`);
    } finally {
      if (prev === undefined) delete process.env.BING_WEBMASTER_API_KEY;
      else process.env.BING_WEBMASTER_API_KEY = prev;
    }
  });

  it('a 400 {ErrorCode, Message} is an api-error, not success', async () => {
    const f = jest.fn(async () =>
      json(400, { ErrorCode: 3, Message: 'InvalidApiKey' })
    );
    const r = await client(f).submitFeed(
      'https://carsi.com.au',
      'https://carsi.com.au/sitemap.xml'
    );
    expect(r).toEqual({
      ok: false,
      kind: 'api-error',
      status: 400,
      errorCode: 3,
      message: 'InvalidApiKey',
    });
  });

  it('a 200 without the d wrapper is bad-response', async () => {
    const f = jest.fn(async () => json(200, { unexpected: true }));
    const r = await client(f).verifySite('https://carsi.com.au');
    expect(r.ok === false && r.kind).toBe('bad-response');
  });

  it('a network error is reported without the key', async () => {
    const f = jest.fn(async () => {
      throw new Error(
        `connect ECONNREFUSED https://ssl.bing.com/x?apikey=${FAKE_KEY}`
      );
    });
    const r = await client(f).addSite('https://carsi.com.au');
    expect(r.ok === false && r.kind).toBe('network-error');
    expect(() => checkNoKeyLeak(r)).not.toThrow();
  });

  it('error echoing the key (control: planted failure is caught)', () => {
    const planted: BingResult<null> = {
      ok: false,
      kind: 'network-error',
      message: `failed ?apikey=${FAKE_KEY}`,
    };
    expect(() => checkNoKeyLeak(planted)).toThrow(/leaked/);
  });
});

describe('submitUrlsWithinQuota', () => {
  const site = 'https://carsi.com.au';
  const list = (n: number) =>
    Array.from({ length: n }, (_, i) => `${site}/p/${i}`);

  function quotaThenOk(daily: number, monthly: number) {
    return jest.fn(async (url: string) =>
      url.includes('/GetUrlSubmissionQuota?')
        ? json(200, { d: { DailyQuota: daily, MonthlyQuota: monthly } })
        : json(200, { d: null })
    );
  }

  /** Fails if more URLs were sent than the quota allowed or a batch is over 500. */
  function checkWithinQuota(
    sentBatches: string[][],
    daily: number,
    monthly: number
  ): void {
    const sent = sentBatches.reduce((n, b) => n + b.length, 0);
    if (sent > Math.min(daily, monthly))
      throw new Error(`sent ${sent} beyond quota`);
    for (const b of sentBatches)
      if (b.length > BING_SUBMIT_URL_BATCH_MAX)
        throw new Error(`batch of ${b.length} over the per-call limit`);
  }

  function sentBatches(f: jest.Mock): string[][] {
    return (f.mock.calls as unknown as FetchCall[])
      .filter(([u]) => u.includes('/SubmitUrlBatch?'))
      .map(([, init]) => JSON.parse(init?.body as string).urlList as string[]);
  }

  it('submits only up to the daily quota and defers the rest', async () => {
    const f = quotaThenOk(5, 24);
    const r = await submitUrlsWithinQuota(client(f), site, list(8));
    expect(r.submitted).toHaveLength(5);
    expect(r.deferred).toHaveLength(3);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/quota/i);
    expect(() => checkWithinQuota(sentBatches(f), 5, 24)).not.toThrow();
  });

  it('respects the monthly quota when it is lower', async () => {
    const f = quotaThenOk(100, 2);
    const r = await submitUrlsWithinQuota(client(f), site, list(4));
    expect(r.submitted).toHaveLength(2);
    expect(r.deferred).toHaveLength(2);
  });

  it('splits into batches of at most 500', async () => {
    const f = quotaThenOk(10_000, 10_000);
    const r = await submitUrlsWithinQuota(client(f), site, list(1_200));
    expect(r.ok).toBe(true);
    expect(sentBatches(f).map(b => b.length)).toEqual([500, 500, 200]);
    expect(() =>
      checkWithinQuota(sentBatches(f), 10_000, 10_000)
    ).not.toThrow();
  });

  it('zero quota sends nothing', async () => {
    const f = quotaThenOk(0, 10);
    const r = await submitUrlsWithinQuota(client(f), site, list(3));
    expect(r.ok).toBe(false);
    expect(r.submitted).toEqual([]);
    expect(r.deferred).toHaveLength(3);
    expect(sentBatches(f)).toEqual([]);
  });

  it('a quota lookup failure sends nothing', async () => {
    const f = jest.fn(async () =>
      json(400, { ErrorCode: 14, Message: 'NotAuthorized' })
    );
    const r = await submitUrlsWithinQuota(client(f), site, list(3));
    expect(r.ok).toBe(false);
    expect(r.submitted).toEqual([]);
    expect(r.deferred).toHaveLength(3);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('a failed batch defers it and everything after it', async () => {
    let batch = 0;
    const f = jest.fn(async (url: string) => {
      if (url.includes('/GetUrlSubmissionQuota?'))
        return json(200, { d: { DailyQuota: 10_000, MonthlyQuota: 10_000 } });
      batch += 1;
      return batch === 2
        ? json(400, { ErrorCode: 2, Message: 'ThrottleUser' })
        : json(200, { d: null });
    });
    const r = await submitUrlsWithinQuota(client(f), site, list(1_200));
    expect(r.ok).toBe(false);
    expect(r.submitted).toHaveLength(500);
    expect(r.deferred).toHaveLength(700);
  });

  it('submitting past quota (control: planted failure is caught)', () => {
    const planted = [list(8)]; // a submitter that ignored a daily quota of 5
    expect(() => checkWithinQuota(planted, 5, 24)).toThrow(/beyond quota/);
  });
});
