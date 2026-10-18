/**
 * Unit tests — pulse-survey.ts + journey API routes — SYN-677
 *
 * Validates:
 * 1. buildPulseSurveyHtml returns well-formed HTML with all 5 score links
 *    and that each link carries a verifiable signed token
 * 2. buildTrackedUrl wraps destination URL inside a signed click token
 * 3. GET /api/journey/pulse returns the 1×1 GIF under HTTP 503
 *    FEATURE_NOT_PROVISIONED (client_journey_events has no data model)
 * 4. GET /api/journey/click validates URL safety, redirects to the signed
 *    destination and flags the click as not recorded
 *
 * URL format moved from `?client_id=&moment_id=&score=&url=` (unsigned,
 * tenant-forgery exploitable) to `?t=<token>` (HMAC-signed) after the
 * journey-hmac PR. See lib/journey/pixel-token.ts.
 */

// `server-only` is a runtime sentinel for production — mock it for Jest.
jest.mock('server-only', () => ({}));

import {
  buildPulseSurveyHtml,
  buildTrackedUrl,
} from '@/lib/journey/pulse-survey';
import {
  PIXEL_AUDIENCES,
  signJourneyToken,
  verifyJourneyToken,
  type PixelAudience,
} from '@/lib/journey/pixel-token';

// ── Data-layer guard ─────────────────────────────────────────────────────────
// client_journey_events has no Prisma model, so these routes must never touch
// the data layer. Any prisma access is recorded and asserted empty.

const mockDataCalls: string[] = [];
jest.mock('@/lib/prisma', () => {
  const client = new Proxy(
    {},
    {
      get: (_t, model) =>
        new Proxy(
          {},
          {
            get:
              (_m, op) =>
              (...args: unknown[]) => {
                mockDataCalls.push(`${String(model)}.${String(op)}`);
                return Promise.resolve(args);
              },
          }
        ),
    }
  );
  return { __esModule: true, default: client, prisma: client };
});

// ── next/server mock ─────────────────────────────────────────────────────────

jest.mock('next/server', () => {
  const { NextResponse } = jest.requireActual('next/server');
  return {
    NextResponse,
    NextRequest: class NextRequest extends Request {},
  };
});

const SIGNING_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockDataCalls.length = 0;
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  process.env.NEXT_PUBLIC_APP_URL = 'https://synthex.social';
  process.env.JOURNEY_PIXEL_SIGNING_KEY_PRIMARY = SIGNING_KEY;
  delete process.env.JOURNEY_PIXEL_ACCEPT_UNSIGNED;
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(url: string): { nextUrl: { searchParams: URLSearchParams } } {
  const parsed = new URL(url);
  return { nextUrl: { searchParams: parsed.searchParams } } as never;
}

/** Messages logged when a verified write is dropped (the only side effect left). */
function droppedWriteLogs(): string[] {
  return warnSpy.mock.calls
    .map(c => String(c[0]))
    .filter(m => m.includes('not recorded'));
}

/** Everything a caller can observe from a response. */
async function observe(res: Response) {
  return {
    status: res.status,
    headers: Array.from(res.headers.entries()).sort(),
    body: await res.text(),
  };
}

function signFor(
  aud: PixelAudience,
  clientId: string,
  momentId: string,
  extras: { score?: 1 | 2 | 3 | 4 | 5; url?: string } = {}
): string {
  return signJourneyToken({ aud, clientId, momentId, ...extras });
}

/** Extract the `?t=` token from any builder-produced URL. */
function extractToken(url: string): string {
  const t = new URL(url, 'https://synthex.social').searchParams.get('t');
  if (!t) throw new Error(`URL has no token: ${url}`);
  return t;
}

/** Pull every `?t=…` token out of the rendered HTML, in order of appearance. */
function tokensFromHtml(html: string): string[] {
  return Array.from(
    html.matchAll(/[?&]t=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g)
  ).map(m => m[1]);
}

function loadPulse() {
  jest.resetModules();
  return require('@/app/api/journey/pulse/route') as {
    GET: (req: unknown) => Promise<Response>;
  };
}

function loadClick() {
  jest.resetModules();
  return require('@/app/api/journey/click/route') as {
    GET: (req: unknown) => Promise<Response>;
  };
}

// ── buildPulseSurveyHtml ─────────────────────────────────────────────────────

describe('buildPulseSurveyHtml', () => {
  it('emits exactly 5 click links and 5 pulse pixels, each with a signed token', () => {
    const html = buildPulseSurveyHtml({
      clientId: 'org-abc',
      momentId: 'evt-123',
    });
    expect(typeof html).toBe('string');
    expect(html).toContain('api/journey/click');
    expect(html).toContain('api/journey/pulse');

    const clickMatches = html.match(/api\/journey\/click\?t=/g) ?? [];
    const pulseMatches = html.match(/api\/journey\/pulse\?t=/g) ?? [];
    expect(clickMatches.length).toBe(5);
    expect(pulseMatches.length).toBeGreaterThanOrEqual(5);
  });

  it('signs each score link with the correct client_id, moment_id, score, and audience', () => {
    const html = buildPulseSurveyHtml({
      clientId: 'org-xyz',
      momentId: 'evt-456',
    });
    const tokens = tokensFromHtml(html);
    expect(tokens.length).toBeGreaterThan(0);

    // Verify EVERY token decodes and is bound to org-xyz / evt-456.
    for (const tok of tokens) {
      // Determine audience by trying each — the route demands a specific aud.
      const tried = [
        PIXEL_AUDIENCES.click,
        PIXEL_AUDIENCES.pulse,
        PIXEL_AUDIENCES.pulseConfirm,
      ] as const;
      const matched = tried
        .map(aud => ({ aud, res: verifyJourneyToken(tok, aud) }))
        .find(x => x.res.ok);
      expect(matched).toBeDefined();
      if (matched && matched.res.ok) {
        expect(matched.res.payload.cid).toBe('org-xyz');
        expect(matched.res.payload.mid).toBe('evt-456');
      }
    }
  });

  it('renders custom question text', () => {
    const html = buildPulseSurveyHtml({
      clientId: 'org-abc',
      momentId: 'evt-123',
      question: 'Was this helpful?',
    });
    expect(html).toContain('Was this helpful?');
  });

  it('uses default question when not provided', () => {
    const html = buildPulseSurveyHtml({
      clientId: 'org-abc',
      momentId: 'evt-123',
    });
    expect(html).toContain('How helpful was this update?');
  });
});

// ── buildTrackedUrl ──────────────────────────────────────────────────────────

describe('buildTrackedUrl', () => {
  it('returns a signed click-route URL whose token carries the destination', () => {
    const dest = 'https://example.com/dashboard';
    const tracked = buildTrackedUrl('org-abc', 'evt-123', dest);
    expect(tracked).toContain('api/journey/click?t=');

    const tok = extractToken(tracked);
    const result = verifyJourneyToken(tok, PIXEL_AUDIENCES.click);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.cid).toBe('org-abc');
      expect(result.payload.mid).toBe('evt-123');
      expect(result.payload.u).toBe(dest);
    }
  });

  it('preserves query-strings inside the signed destination URL', () => {
    const dest = 'https://synthex.social/dashboard?foo=bar&baz=qux';
    const tracked = buildTrackedUrl('org-abc', 'evt-123', dest);
    const tok = extractToken(tracked);
    const result = verifyJourneyToken(tok, PIXEL_AUDIENCES.click);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.u).toBe(dest);
  });
});

// ── GET /api/journey/pulse ───────────────────────────────────────────────────

describe('GET /api/journey/pulse', () => {
  it('returns a 1×1 GIF under 503 FEATURE_NOT_PROVISIONED for a valid signed token', async () => {
    const { GET } = loadPulse();
    const t = signFor(PIXEL_AUDIENCES.pulse, 'org-abc', 'evt-123', {
      score: 4,
    });
    const res = await GET(
      makeReq(`https://synthex.social/api/journey/pulse?t=${t}`)
    );
    expect(res.status).toBe(503);
    expect(res.headers.get('X-Error')).toBe('FEATURE_NOT_PROVISIONED');
    expect(res.headers.get('Content-Type')).toBe('image/gif');
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  it('returns pixel with no data-layer call or recorded write when token is missing', async () => {
    const { GET } = loadPulse();
    const res = await GET(makeReq('https://synthex.social/api/journey/pulse'));
    expect(res.status).toBe(503);
    expect(res.headers.get('Content-Type')).toBe('image/gif');
    expect(mockDataCalls).toEqual([]);
    expect(droppedWriteLogs()).toEqual([]);
  });

  it('returns pixel with no data-layer call or recorded write for a forged token', async () => {
    const { GET } = loadPulse();
    const res = await GET(
      makeReq('https://synthex.social/api/journey/pulse?t=not.a-valid-token')
    );
    expect(res.status).toBe(503);
    expect(res.headers.get('Content-Type')).toBe('image/gif');
    expect(mockDataCalls).toEqual([]);
    expect(droppedWriteLogs()).toEqual([]);
  });

  it('treats a token bound to a different route (aud-mismatch) exactly like a forged one', async () => {
    const { GET } = loadPulse();
    // A click-aud token must NOT be accepted by the pulse route.
    const t = signFor(PIXEL_AUDIENCES.click, 'org-abc', 'evt-123', {
      url: 'https://example.com',
    });
    const mismatched = await observe(
      await GET(makeReq(`https://synthex.social/api/journey/pulse?t=${t}`))
    );
    expect(mockDataCalls).toEqual([]);
    expect(droppedWriteLogs()).toEqual([]);
    expect(
      warnSpy.mock.calls.some(c => String(c[0]).includes('token-verify failed'))
    ).toBe(true);

    const forged = await observe(
      await GET(
        makeReq('https://synthex.social/api/journey/pulse?t=not.a-valid-token')
      )
    );
    expect(mismatched).toEqual(forged);
  });

  it('logs the dropped write only for a valid pulse-aud token', async () => {
    const { GET } = loadPulse();
    const t = signFor(PIXEL_AUDIENCES.pulse, 'org-abc', 'evt-123', {
      score: 2,
    });
    await GET(makeReq(`https://synthex.social/api/journey/pulse?t=${t}`));
    expect(droppedWriteLogs()).toHaveLength(1);
    expect(mockDataCalls).toEqual([]);
  });
});

// ── GET /api/journey/click ───────────────────────────────────────────────────

describe('GET /api/journey/click', () => {
  it('redirects to the destination URL carried in the signed token', async () => {
    const { GET } = loadClick();
    const dest = 'https://synthex.social/dashboard';
    const t = signFor(PIXEL_AUDIENCES.click, 'org-abc', 'evt-123', {
      url: dest,
    });
    const res = await GET(
      makeReq(`https://synthex.social/api/journey/click?t=${t}`)
    );
    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    if (location) expect(location).toBe(dest);
  });

  it('does not redirect to a javascript: URL even when carried in a signed token', async () => {
    const { GET } = loadClick();
    const t = signFor(PIXEL_AUDIENCES.click, 'org-abc', 'evt-123', {
      url: 'javascript:alert(1)',
    });
    const res = await GET(
      makeReq(`https://synthex.social/api/journey/click?t=${t}`)
    );
    expect(res.status).toBe(302);
    const location = res.headers.get('location') ?? '';
    expect(location).not.toBe('javascript:alert(1)');
    expect(location).not.toContain('javascript:');
  });

  it('returns 302 to fallback when the token is missing', async () => {
    const { GET } = loadClick();
    const res = await GET(makeReq('https://synthex.social/api/journey/click'));
    expect(res.status).toBe(302);
  });

  it('sends an aud-mismatched token to the fallback with no recorded click', async () => {
    const { GET } = loadClick();
    // A pulse-aud token must NOT be accepted by the click route.
    const t = signFor(PIXEL_AUDIENCES.pulse, 'org-abc', 'evt-123', {
      score: 4,
    });
    const res = await GET(
      makeReq(`https://synthex.social/api/journey/click?t=${t}`)
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      'https://synthex.social/dashboard'
    );
    expect(res.headers.get('X-Journey-Tracking')).toBeNull();
    expect(mockDataCalls).toEqual([]);
    expect(droppedWriteLogs()).toEqual([]);
  });

  it('flags the click as not recorded on the redirect', async () => {
    const { GET } = loadClick();
    const dest = 'https://synthex.social/dashboard';
    const t = signFor(PIXEL_AUDIENCES.click, 'org-abc', 'evt-123', {
      url: dest,
    });
    const res = await GET(
      makeReq(`https://synthex.social/api/journey/click?t=${t}`)
    );
    expect(res.headers.get('X-Journey-Tracking')).toBe(
      'FEATURE_NOT_PROVISIONED'
    );
  });
});
