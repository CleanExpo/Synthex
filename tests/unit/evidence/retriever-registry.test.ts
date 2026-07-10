/**
 * Retriever registry + SSRF boundary tests (SYN-MCP-006).
 *
 * Proves the registry ships all three adapters (Exa registered-but-dormant)
 * and that activation is env-key-only — zero code.
 */
import {
  assertFetchUrlAllowed,
  getAvailableRetrievers,
  getEvidenceRetrievers,
} from '@/lib/evidence/retriever';

// Keep the unit profile hermetic — the apify wrapper imports apify-client at
// module load; the registry test never calls the network anyway.
jest.mock('apify-client', () => ({ ApifyClient: class {} }));

describe('evidence retriever registry', () => {
  const KEYS = ['FIRECRAWL_API_KEY', 'APIFY_API_TOKEN', 'EXA_API_KEY'] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('registers firecrawl, apify, and exa (in deterministic order)', () => {
    const ids = getEvidenceRetrievers().map(r => r.id);
    expect(ids).toEqual(['firecrawl', 'apify', 'exa']);
  });

  it('declares the agreed capability matrix', () => {
    const byId = Object.fromEntries(
      getEvidenceRetrievers().map(r => [r.id, r.capabilities])
    );
    expect(byId).toEqual({
      firecrawl: { canSearch: true, canFetch: true },
      apify: { canSearch: false, canFetch: true },
      exa: { canSearch: true, canFetch: true },
    });
  });

  it('no keys → no available retrievers', () => {
    expect(getAvailableRetrievers()).toHaveLength(0);
  });

  it('exa activates with EXA_API_KEY alone — zero code (dormant-ship proof)', () => {
    expect(getAvailableRetrievers().map(r => r.id)).not.toContain('exa');
    process.env.EXA_API_KEY = 'provisioned-later';
    expect(getAvailableRetrievers().map(r => r.id)).toContain('exa');
  });

  it('firecrawl + apify activate from their existing env keys', () => {
    process.env.FIRECRAWL_API_KEY = 'fc';
    process.env.APIFY_API_TOKEN = 'ap';
    expect(getAvailableRetrievers().map(r => r.id)).toEqual([
      'firecrawl',
      'apify',
    ]);
  });
});

describe('assertFetchUrlAllowed — SSRF/protocol boundary', () => {
  it.each(['https://example.com/page', 'http://public-site.org/a?b=c'])(
    'allows public http(s) URL: %s',
    url => {
      expect(() => assertFetchUrlAllowed(url)).not.toThrow();
    }
  );

  it.each([
    ['non-http protocol', 'file:///etc/passwd'],
    ['non-http protocol', 'ftp://example.com/x'],
    ['non-http protocol', 'javascript:alert(1)'],
    ['localhost', 'http://localhost:3000/'],
    ['loopback', 'http://127.0.0.1/'],
    ['private 10/8', 'http://10.1.2.3/'],
    ['private 172.16/12', 'http://172.20.0.1/'],
    ['private 192.168/16', 'http://192.168.1.1/'],
    ['link-local/metadata', 'http://169.254.169.254/latest/meta-data'],
    ['ipv6 loopback', 'http://[::1]/'],
    ['ipv4-mapped ipv6 metadata', 'http://[::ffff:169.254.169.254]/'],
    ['invalid', 'not a url'],
  ])('rejects %s: %s', (_label, url) => {
    expect(() => assertFetchUrlAllowed(url)).toThrow();
  });
});
