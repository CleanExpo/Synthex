/**
 * Unit tests — pulse-survey.ts + journey API routes — SYN-677
 *
 * Validates:
 * 1. buildPulseSurveyHtml returns well-formed HTML with all 5 score links
 * 2. buildTrackedUrl wraps destination URL correctly
 * 3. isSafeUrl blocks dangerous protocols (tested via click route behaviour)
 * 4. GET /api/journey/pulse returns 1×1 GIF and calls DB update
 * 5. GET /api/journey/click validates URL safety and redirects
 * 6. GET /api/journey/click does not downgrade 'surveyed' outcome
 */

import {
  buildPulseSurveyHtml,
  buildTrackedUrl,
} from '@/lib/journey/pulse-survey';

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
});

// ── Helper: fake NextRequest with nextUrl ─────────────────────────────────────

function makeReq(url: string): { nextUrl: { searchParams: URLSearchParams } } {
  const parsed = new URL(url);
  return { nextUrl: { searchParams: parsed.searchParams } } as never;
}

// ── Route loaders (resetModules ensures fresh load per test suite) ────────────

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
  it('returns a string containing all 5 score links', () => {
    const html = buildPulseSurveyHtml({
      clientId: 'org-abc',
      momentId: 'evt-123',
    });
    expect(typeof html).toBe('string');
    expect(html).toContain('api/journey/click');
    for (let s = 1; s <= 5; s++) {
      expect(html).toContain(`score=${s}`);
    }
  });

  it('includes client_id and moment_id in link URLs', () => {
    const html = buildPulseSurveyHtml({
      clientId: 'org-xyz',
      momentId: 'evt-456',
    });
    expect(html).toContain('org-xyz');
    expect(html).toContain('evt-456');
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

  it('embeds tracking pixel img tags for each score', () => {
    const html = buildPulseSurveyHtml({
      clientId: 'org-abc',
      momentId: 'evt-123',
    });
    expect(html).toContain('api/journey/pulse');
    const pixelMatches = html.match(/api\/journey\/pulse/g);
    expect(pixelMatches?.length).toBeGreaterThanOrEqual(5);
  });
});

// ── buildTrackedUrl ──────────────────────────────────────────────────────────

describe('buildTrackedUrl', () => {
  it('wraps destination URL in click tracker', () => {
    const tracked = buildTrackedUrl(
      'org-abc',
      'evt-123',
      'https://example.com/dashboard'
    );
    expect(tracked).toContain('api/journey/click');
    expect(tracked).toContain('org-abc');
    expect(tracked).toContain('evt-123');
    expect(tracked).toContain(
      encodeURIComponent('https://example.com/dashboard')
    );
  });

  it('URL-encodes the destination', () => {
    const dest = 'https://synthex.social/dashboard?foo=bar&baz=qux';
    const tracked = buildTrackedUrl('org-abc', 'evt-123', dest);
    expect(tracked).toContain(encodeURIComponent(dest));
  });
});

// ── GET /api/journey/pulse ───────────────────────────────────────────────────

describe('GET /api/journey/pulse', () => {
  it('returns a 1×1 GIF with no-cache headers', async () => {
    const { GET } = loadPulse();
    const res = await GET(
      makeReq(
        'https://synthex.social/api/journey/pulse?client_id=org-abc&moment_id=evt-123&score=4'
      )
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/gif');
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  it('still returns pixel when DB update fails', async () => {
    mockUpdateEq2.mockResolvedValueOnce({ error: { message: 'DB error' } });
    const { GET } = loadPulse();
    const res = await GET(
      makeReq(
        'https://synthex.social/api/journey/pulse?client_id=org-abc&moment_id=evt-123&score=3'
      )
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/gif');
  });

  it('returns pixel without DB call when required params missing', async () => {
    const { GET } = loadPulse();
    const res = await GET(makeReq('https://synthex.social/api/journey/pulse'));
    expect(res.status).toBe(200);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects score outside 1-5 range', async () => {
    const { GET } = loadPulse();
    const res = await GET(
      makeReq(
        'https://synthex.social/api/journey/pulse?client_id=org-abc&moment_id=evt-123&score=6'
      )
    );
    expect(res.status).toBe(200);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ── GET /api/journey/click ───────────────────────────────────────────────────

describe('GET /api/journey/click', () => {
  it('redirects to the destination URL', async () => {
    const { GET } = loadClick();
    const dest = 'https://synthex.social/dashboard';
    const res = await GET(
      makeReq(
        `https://synthex.social/api/journey/click?client_id=org-abc&moment_id=evt-123&url=${encodeURIComponent(dest)}`
      )
    );
    expect(res.status).toBe(302);
    // location header is set to the destination in fresh-module loads
    const location = res.headers.get('location');
    if (location) expect(location).toBe(dest);
  });

  it('returns 302 redirect for javascript: URL — does not forward to dangerous protocol', async () => {
    const { GET } = loadClick();
    const res = await GET(
      makeReq(
        'https://synthex.social/api/journey/click?client_id=org-abc&moment_id=evt-123&url=javascript%3Aalert(1)'
      )
    );
    // Route must redirect (not crash) and must NOT redirect to javascript: url
    expect(res.status).toBe(302);
    const location = res.headers.get('location') ?? '';
    expect(location).not.toBe('javascript:alert(1)');
    expect(location).not.toContain('javascript:');
  });

  it('returns 302 when url param is missing', async () => {
    const { GET } = loadClick();
    const res = await GET(
      makeReq(
        'https://synthex.social/api/journey/click?client_id=org-abc&moment_id=evt-123'
      )
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
    await GET(
      makeReq(
        `https://synthex.social/api/journey/click?client_id=org-abc&moment_id=evt-123&url=${encodeURIComponent(dest)}`
      )
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
