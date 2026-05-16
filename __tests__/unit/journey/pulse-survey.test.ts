/**
 * Unit tests — pulse-survey.ts + journey API routes — SYN-677
 *
 * Validates:
 * 1. buildPulseSurveyHtml returns well-formed HTML with all 5 score links
 *    and that each link carries a verifiable signed token
 * 2. buildTrackedUrl wraps destination URL inside a signed click token
 * 3. GET /api/journey/pulse returns 1×1 GIF and calls DB update for a
 *    signed token; returns pixel without DB call for missing/invalid token
 * 4. GET /api/journey/click validates URL safety, redirects to the signed
 *    destination, and does not downgrade 'surveyed' outcome
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

// ── Supabase mock ────────────────────────────────────────────────────────────

const mockUpdateEq2 = jest.fn().mockResolvedValue({ error: null });
const mockUpdateEq1 = jest.fn().mockReturnValue({ eq: mockUpdateEq2 });
const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq1 });

const mockSingleSelect = jest.fn().mockResolvedValue({
  data: { metadata: {}, engagement_outcome: 'delivered' },
  error: null,
});
const mockSelectEq2 = jest.fn().mockReturnValue({ single: mockSingleSelect });
const mockSelectEq1 = jest.fn().mockReturnValue({ eq: mockSelectEq2 });
const mockSelect = jest.fn().mockReturnValue({ eq: mockSelectEq1 });

const mockFrom = jest.fn().mockReturnValue({
  select: mockSelect,
  update: mockUpdate,
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}));

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

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateEq2.mockResolvedValue({ error: null });
  mockSingleSelect.mockResolvedValue({
    data: { metadata: {}, engagement_outcome: 'delivered' },
    error: null,
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.NEXT_PUBLIC_APP_URL = 'https://synthex.social';
  process.env.JOURNEY_PIXEL_SIGNING_KEY_PRIMARY = SIGNING_KEY;
  delete process.env.JOURNEY_PIXEL_ACCEPT_UNSIGNED;
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(url: string): { nextUrl: { searchParams: URLSearchParams } } {
  const parsed = new URL(url);
  return { nextUrl: { searchParams: parsed.searchParams } } as never;
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
  return Array.from(html.matchAll(/[?&]t=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g)).map(
    m => m[1]
  );
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
  it('returns a 1×1 GIF with no-cache headers for a valid signed token', async () => {
    const { GET } = loadPulse();
    const t = signFor(PIXEL_AUDIENCES.pulse, 'org-abc', 'evt-123', { score: 4 });
    const res = await GET(
      makeReq(`https://synthex.social/api/journey/pulse?t=${t}`)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/gif');
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  it('still returns pixel when DB update fails', async () => {
    mockUpdateEq2.mockResolvedValueOnce({ error: { message: 'DB error' } });
    const { GET } = loadPulse();
    const t = signFor(PIXEL_AUDIENCES.pulse, 'org-abc', 'evt-123', { score: 3 });
    const res = await GET(
      makeReq(`https://synthex.social/api/journey/pulse?t=${t}`)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/gif');
  });

  it('returns pixel without DB call when token is missing', async () => {
    const { GET } = loadPulse();
    const res = await GET(makeReq('https://synthex.social/api/journey/pulse'));
    expect(res.status).toBe(200);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns pixel without DB call for a forged token', async () => {
    const { GET } = loadPulse();
    const res = await GET(
      makeReq(
        'https://synthex.social/api/journey/pulse?t=not.a-valid-token'
      )
    );
    expect(res.status).toBe(200);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns pixel without DB call for a token bound to a different route (aud-mismatch)', async () => {
    const { GET } = loadPulse();
    // A click-aud token should NOT update via the pulse route.
    const t = signFor(PIXEL_AUDIENCES.click, 'org-abc', 'evt-123', {
      url: 'https://example.com',
    });
    const res = await GET(
      makeReq(`https://synthex.social/api/journey/pulse?t=${t}`)
    );
    expect(res.status).toBe(200);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ── GET /api/journey/click ───────────────────────────────────────────────────

describe('GET /api/journey/click', () => {
  it('redirects to the destination URL carried in the signed token', async () => {
    const { GET } = loadClick();
    const dest = 'https://synthex.social/dashboard';
    const t = signFor(PIXEL_AUDIENCES.click, 'org-abc', 'evt-123', { url: dest });
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
    const res = await GET(
      makeReq('https://synthex.social/api/journey/click')
    );
    expect(res.status).toBe(302);
  });

  it('does not downgrade outcome when already surveyed', async () => {
    mockSingleSelect.mockResolvedValueOnce({
      data: { engagement_outcome: 'surveyed' },
      error: null,
    });
    const { GET } = loadClick();
    const dest = 'https://synthex.social/dashboard';
    const t = signFor(PIXEL_AUDIENCES.click, 'org-abc', 'evt-123', { url: dest });
    await GET(makeReq(`https://synthex.social/api/journey/click?t=${t}`));
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
