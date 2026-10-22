/**
 * SEAM: the exported lib/indexnow functions (deriveIndexNowKey,
 * buildIndexNowKeyFileArtefact, classifyIndexNowStatus, buildIndexNowRequests,
 * submitToIndexNow, notifyIndexNowOnPublish), with fetch mocked at the network
 * boundary. Catches: a non-200 response reported as success, batches over the
 * protocol's 10,000-URL limit, off-host URLs sent to the API, a key outside the
 * protocol's charset. Misses: whether api.indexnow.org really behaves as its
 * documentation says (no live call is made).
 *
 * Protocol: https://www.indexnow.org/documentation (read 22/10/2026).
 */
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_MAX_URLS_PER_REQUEST,
  buildIndexNowKeyFileArtefact,
  buildIndexNowRequests,
  classifyIndexNowStatus,
  deriveIndexNowKey,
  notifyIndexNowOnPublish,
  submitToIndexNow,
  type IndexNowOutcome,
} from '@/lib/indexnow';

type FetchCall = [string, RequestInit];

function fetchReturning(...statuses: number[]) {
  let i = 0;
  return jest.fn(async () => {
    const status = statuses[Math.min(i, statuses.length - 1)];
    i += 1;
    return new Response(null, { status });
  });
}

function urls(n: number, host = 'carsi.com.au'): string[] {
  return Array.from({ length: n }, (_, i) => `https://${host}/p/${i}`);
}

/** Fails unless only 200 is ok, 429 is retry-later and 403 is key-not-verified. */
function checkHonestMapping(classify: typeof classifyIndexNowStatus): void {
  for (let s = 100; s < 600; s += 1) {
    if (s !== 200 && classify(s).ok) throw new Error(`status ${s} reported ok`);
  }
  if (classify(429).outcome !== 'retry-later')
    throw new Error('429 is not retry-later');
  if (classify(403).outcome !== 'key-not-verified')
    throw new Error('403 is not key-not-verified');
}

/** Fails if any batch is over the protocol limit or URLs went missing. */
function checkBatches(
  bodies: Array<{ urlList: string[] }>,
  expectedTotal: number
): void {
  for (const b of bodies)
    if (b.urlList.length > INDEXNOW_MAX_URLS_PER_REQUEST)
      throw new Error(`batch of ${b.urlList.length} is over the limit`);
  const total = bodies.reduce((n, b) => n + b.urlList.length, 0);
  if (total !== expectedTotal) throw new Error(`lost URLs: ${total}`);
}

describe('deriveIndexNowKey', () => {
  it('is deterministic for the same client and site', () => {
    const a = deriveIndexNowKey({
      clientSlug: 'carsi',
      siteUrl: 'https://carsi.com.au',
    });
    const b = deriveIndexNowKey({
      clientSlug: 'carsi',
      siteUrl: 'https://carsi.com.au/',
    });
    expect(a).toBe(b);
  });

  it('differs between clients', () => {
    expect(
      deriveIndexNowKey({
        clientSlug: 'carsi',
        siteUrl: 'https://carsi.com.au',
      })
    ).not.toBe(
      deriveIndexNowKey({
        clientSlug: 'restoreassist',
        siteUrl: 'https://restoreassist.app',
      })
    );
  });

  it('meets the protocol charset and length (8-128 of a-zA-Z0-9-)', () => {
    const key = deriveIndexNowKey({
      clientSlug: 'carsi',
      siteUrl: 'https://carsi.com.au',
    });
    expect(key).toMatch(/^[a-zA-Z0-9-]{8,128}$/);
  });
});

describe('buildIndexNowKeyFileArtefact', () => {
  it('describes the file the client site must host at /<key>.txt', () => {
    const art = buildIndexNowKeyFileArtefact({
      clientSlug: 'carsi',
      siteUrl: 'https://carsi.com.au',
    });
    expect(art.path).toBe(`/${art.key}.txt`);
    expect(art.content).toBe(art.key);
    expect(art.keyLocation).toBe(`https://carsi.com.au/${art.key}.txt`);
    expect(art.host).toBe('carsi.com.au');
    expect(art.placedBy).toBe('K7 repo-writer');
  });
});

describe('classifyIndexNowStatus', () => {
  const table: Array<[number, IndexNowOutcome, boolean]> = [
    [200, 'submitted', true],
    [202, 'accepted-key-pending', false],
    [400, 'bad-request', false],
    [403, 'key-not-verified', false],
    [422, 'unprocessable', false],
    [429, 'retry-later', false],
    [500, 'unexpected-status', false],
  ];

  it.each(table)('maps %i to %s (ok=%s)', (status, outcome, ok) => {
    const r = classifyIndexNowStatus(status);
    expect(r.outcome).toBe(outcome);
    expect(r.ok).toBe(ok);
  });

  it('marks 429 as retryable and 403 as not retryable', () => {
    expect(classifyIndexNowStatus(429).retryable).toBe(true);
    expect(classifyIndexNowStatus(403).retryable).toBe(false);
  });

  it('only 200 is ever ok', () => {
    for (let s = 100; s < 600; s += 1) {
      if (s === 200) continue;
      expect(classifyIndexNowStatus(s).ok).toBe(false);
    }
  });

  it('the mapping passes the honesty check', () => {
    expect(() => checkHonestMapping(classifyIndexNowStatus)).not.toThrow();
  });

  it('429 treated as success (control: planted failure is caught)', () => {
    const planted: typeof classifyIndexNowStatus = status =>
      status === 429
        ? classifyIndexNowStatus(200)
        : classifyIndexNowStatus(status);
    expect(() => checkHonestMapping(planted)).toThrow(/429/);
  });

  it('403 treated as success (control: planted failure is caught)', () => {
    const planted: typeof classifyIndexNowStatus = status =>
      status === 403
        ? classifyIndexNowStatus(200)
        : classifyIndexNowStatus(status);
    expect(() => checkHonestMapping(planted)).toThrow(/403/);
  });
});

describe('buildIndexNowRequests', () => {
  const base = {
    host: 'carsi.com.au',
    key: 'abcdef0123456789',
    keyLocation: 'https://carsi.com.au/abcdef0123456789.txt',
  };

  it('builds the documented body {host,key,keyLocation,urlList}', () => {
    const { bodies } = buildIndexNowRequests({ ...base, urls: urls(2) });
    expect(bodies).toEqual([
      {
        host: 'carsi.com.au',
        key: 'abcdef0123456789',
        keyLocation: 'https://carsi.com.au/abcdef0123456789.txt',
        urlList: ['https://carsi.com.au/p/0', 'https://carsi.com.au/p/1'],
      },
    ]);
  });

  it('chunks 10,001 URLs into 10,000 + 1', () => {
    const { bodies } = buildIndexNowRequests({ ...base, urls: urls(10_001) });
    expect(bodies.map(b => b.urlList.length)).toEqual([10_000, 1]);
  });

  it('never emits a batch above the protocol limit', () => {
    const { bodies } = buildIndexNowRequests({ ...base, urls: urls(25_000) });
    expect(Math.max(...bodies.map(b => b.urlList.length))).toBeLessThanOrEqual(
      10_000
    );
    expect(bodies.reduce((n, b) => n + b.urlList.length, 0)).toBe(25_000);
  });

  it('25,000 URLs pass the batch check', () => {
    const { bodies } = buildIndexNowRequests({ ...base, urls: urls(25_000) });
    expect(() => checkBatches(bodies, 25_000)).not.toThrow();
  });

  it('>10k not chunked (control: planted failure is caught)', () => {
    const planted = [{ ...base, urlList: urls(10_001) }];
    expect(() => checkBatches(planted, 10_001)).toThrow(/limit/);
  });

  it('rejects URLs on another host instead of sending them', () => {
    const { bodies, rejectedOffHost } = buildIndexNowRequests({
      ...base,
      urls: ['https://carsi.com.au/a', 'https://evil.example/b', 'not a url'],
    });
    expect(bodies[0].urlList).toEqual(['https://carsi.com.au/a']);
    expect(rejectedOffHost).toEqual(['https://evil.example/b', 'not a url']);
  });

  it('de-duplicates URLs', () => {
    const { bodies } = buildIndexNowRequests({
      ...base,
      urls: ['https://carsi.com.au/a', 'https://carsi.com.au/a'],
    });
    expect(bodies[0].urlList).toEqual(['https://carsi.com.au/a']);
  });
});

describe('submitToIndexNow', () => {
  const input = {
    host: 'carsi.com.au',
    key: 'abcdef0123456789',
    keyLocation: 'https://carsi.com.au/abcdef0123456789.txt',
  };

  it('POSTs JSON to the IndexNow endpoint and reports 200 as ok', async () => {
    const fetchImpl = fetchReturning(200);
    const r = await submitToIndexNow(
      { ...input, urls: urls(3) },
      { fetchImpl: fetchImpl as unknown as typeof fetch }
    );
    expect(r.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as FetchCall;
    expect(url).toBe(INDEXNOW_ENDPOINT);
    expect(INDEXNOW_ENDPOINT).toBe('https://api.indexnow.org/indexnow');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toMatch(
      /application\/json/
    );
    expect(JSON.parse(init.body as string).urlList).toHaveLength(3);
  });

  it('429 is retry-later and never ok', async () => {
    const r = await submitToIndexNow(
      { ...input, urls: urls(1) },
      { fetchImpl: fetchReturning(429) as unknown as typeof fetch }
    );
    expect(r.ok).toBe(false);
    expect(r.batches[0].outcome).toBe('retry-later');
    expect(r.batches[0].retryable).toBe(true);
  });

  it('403 is key-not-verified and never ok', async () => {
    const r = await submitToIndexNow(
      { ...input, urls: urls(1) },
      { fetchImpl: fetchReturning(403) as unknown as typeof fetch }
    );
    expect(r.ok).toBe(false);
    expect(r.batches[0].outcome).toBe('key-not-verified');
  });

  it('202 is accepted with key validation pending, not ok', async () => {
    const r = await submitToIndexNow(
      { ...input, urls: urls(1) },
      { fetchImpl: fetchReturning(202) as unknown as typeof fetch }
    );
    expect(r.ok).toBe(false);
    expect(r.batches[0].outcome).toBe('accepted-key-pending');
  });

  it('one bad batch makes the whole submission not ok', async () => {
    const r = await submitToIndexNow(
      { ...input, urls: urls(10_001) },
      { fetchImpl: fetchReturning(200, 429) as unknown as typeof fetch }
    );
    expect(r.batches.map(b => b.outcome)).toEqual(['submitted', 'retry-later']);
    expect(r.ok).toBe(false);
  });

  it('a network failure is reported, not thrown', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('socket hang up');
    });
    const r = await submitToIndexNow(
      { ...input, urls: urls(1) },
      { fetchImpl: fetchImpl as unknown as typeof fetch }
    );
    expect(r.ok).toBe(false);
    expect(r.batches[0].outcome).toBe('network-error');
  });

  it('an invalid key makes no network call', async () => {
    const fetchImpl = fetchReturning(200);
    const r = await submitToIndexNow(
      { ...input, key: 'bad key!', urls: urls(1) },
      { fetchImpl: fetchImpl as unknown as typeof fetch }
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/invalid key/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('nothing to submit is not ok and makes no call', async () => {
    const fetchImpl = fetchReturning(200);
    const r = await submitToIndexNow(
      { ...input, urls: ['https://other.example/x'] },
      { fetchImpl: fetchImpl as unknown as typeof fetch }
    );
    expect(r.ok).toBe(false);
    expect(r.rejectedOffHost).toEqual(['https://other.example/x']);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('off-host URLs make the submission not ok even when the batch is 200', async () => {
    const r = await submitToIndexNow(
      { ...input, urls: ['https://carsi.com.au/a', 'https://other.example/x'] },
      { fetchImpl: fetchReturning(200) as unknown as typeof fetch }
    );
    expect(r.batches[0].ok).toBe(true);
    expect(r.ok).toBe(false);
  });
});

describe('notifyIndexNowOnPublish', () => {
  it('submits the published URLs with the client key and its key file location', async () => {
    const fetchImpl = fetchReturning(200);
    const r = await notifyIndexNowOnPublish(
      {
        clientSlug: 'carsi',
        siteUrl: 'https://carsi.com.au',
        publishedUrls: ['https://carsi.com.au/courses/new'],
      },
      { fetchImpl: fetchImpl as unknown as typeof fetch }
    );
    expect(r.ok).toBe(true);
    const key = deriveIndexNowKey({
      clientSlug: 'carsi',
      siteUrl: 'https://carsi.com.au',
    });
    const [, init] = fetchImpl.mock.calls[0] as unknown as FetchCall;
    const body = JSON.parse(init.body as string);
    expect(body.key).toBe(key);
    expect(body.keyLocation).toBe(`https://carsi.com.au/${key}.txt`);
    expect(body.host).toBe('carsi.com.au');
  });

  it('skips honestly when nothing was published', async () => {
    const fetchImpl = fetchReturning(200);
    const r = await notifyIndexNowOnPublish(
      {
        clientSlug: 'carsi',
        siteUrl: 'https://carsi.com.au',
        publishedUrls: [],
      },
      { fetchImpl: fetchImpl as unknown as typeof fetch }
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no published urls/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
