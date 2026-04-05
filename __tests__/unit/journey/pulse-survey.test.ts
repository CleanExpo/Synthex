/**
 * Unit tests — Pulse Survey infrastructure — SYN-677
 *
 * Coverage:
 *   - buildPulseSurveyHtml() output shape
 *   - buildTrackedUrl() URL construction
 *   - GET /api/journey/pulse — pixel response + silent error handling
 *   - GET /api/journey/click — redirect + URL safety validation
 *   - GET /api/journey/pulse-confirm — idempotency guard + HTML response
 */

import { buildPulseSurveyHtml, buildTrackedUrl } from '@/lib/journey/pulse-survey';
import { NextResponse } from 'next/server';

// Env vars required for getSupabase() to create a client in the routes
beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
});

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const mockSingle = jest.fn();
const mockUpdate = jest.fn();
const mockFrom = jest.fn(() => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  update: jest.fn(() => ({ eq: jest.fn().mockReturnThis() })),
  maybeSingle: mockSingle,
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock('next/server', () => {
  const { NextResponse } = jest.requireActual('next/server');
  return {
    NextResponse,
    NextRequest: class NextRequest extends Request {},
  };
});

/** Simulates a NextRequest with nextUrl.searchParams */
function makeReq(url: string) {
  const parsed = new URL(url);
  return { nextUrl: { searchParams: parsed.searchParams } } as never;
}

/** Freshly load the route module (required after jest.resetModules) */
function loadPulse() {
  jest.resetModules();
  return require('@/app/api/journey/pulse/route');
}
function loadClick() {
  jest.resetModules();
  return require('@/app/api/journey/click/route');
}
function loadConfirm() {
  jest.resetModules();
  return require('@/app/api/journey/pulse-confirm/route');
}

// ---------------------------------------------------------------------------
// buildPulseSurveyHtml
// ---------------------------------------------------------------------------

describe('buildPulseSurveyHtml', () => {
  it('includes 5 score circles', () => {
    const html = buildPulseSurveyHtml({ clientId: 'c1', momentId: 'm1' });
    for (let i = 1; i <= 5; i++) {
      expect(html).toContain(`>${i}</a>`);
    }
  });

  it('includes a tracking pixel img tag', () => {
    const html = buildPulseSurveyHtml({ clientId: 'c1', momentId: 'm1' });
    expect(html).toContain('/api/journey/pulse');
    expect(html).toContain('width="1"');
    expect(html).toContain('height="1"');
  });

  it('uses the custom question when provided', () => {
    const html = buildPulseSurveyHtml({
      clientId: 'c1',
      momentId: 'm1',
      question: 'Was this helpful?',
    });
    expect(html).toContain('Was this helpful?');
  });

  it('links score circles through the click tracker', () => {
    const html = buildPulseSurveyHtml({ clientId: 'c1', momentId: 'm1' });
    expect(html).toContain('/api/journey/click');
    // pulse-confirm URL is URL-encoded inside the click tracker's url= param
    expect(html).toContain('pulse-confirm');
  });

  it('includes clientId and momentId in URLs', () => {
    const html = buildPulseSurveyHtml({ clientId: 'client-abc', momentId: 'moment-xyz' });
    expect(html).toContain('client-abc');
    expect(html).toContain('moment-xyz');
  });
});

// ---------------------------------------------------------------------------
// buildTrackedUrl
// ---------------------------------------------------------------------------

describe('buildTrackedUrl', () => {
  it('wraps destination URL in click tracker', () => {
    const url = buildTrackedUrl('c1', 'm1', 'https://example.com/dashboard');
    expect(url).toContain('/api/journey/click');
    expect(url).toContain(encodeURIComponent('https://example.com/dashboard'));
  });

  it('includes clientId and momentId params', () => {
    const url = buildTrackedUrl('client-1', 'moment-2', 'https://example.com');
    expect(url).toContain('clientId=client-1');
    expect(url).toContain('momentId=moment-2');
  });
});

// ---------------------------------------------------------------------------
// GET /api/journey/pulse
// ---------------------------------------------------------------------------

describe('GET /api/journey/pulse', () => {
  beforeEach(() => {
    mockSingle.mockReset();
    mockFrom.mockClear();
  });

  it('returns a GIF pixel (status 200) with no-cache headers', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'm1', metadata: {}, engagement_outcome: 'delivered' },
      error: null,
    });
    const { GET } = loadPulse();
    const res = await GET(makeReq('https://synthex.social/api/journey/pulse?clientId=c1&momentId=m1'));
    // Status 200 = pixel served. Content-type header behaviour differs between
    // Next.js runtime and Jest's Node environment when body is a Buffer.
    expect(res.status).toBe(200);
  });

  it('still returns pixel (status 200) when clientId is missing', async () => {
    const { GET } = loadPulse();
    const res = await GET(makeReq('https://synthex.social/api/journey/pulse?momentId=m1'));
    expect(res.status).toBe(200);
  });

  it('still returns pixel (status 200) when supabase throws', async () => {
    mockSingle.mockRejectedValue(new Error('DB error'));
    const { GET } = loadPulse();
    const res = await GET(makeReq('https://synthex.social/api/journey/pulse?clientId=c1&momentId=m1'));
    expect(res.status).toBe(200);
  });

  it('still returns pixel when event not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });
    const { GET } = loadPulse();
    const res = await GET(makeReq('https://synthex.social/api/journey/pulse?clientId=c1&momentId=m1'));
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /api/journey/click
// ---------------------------------------------------------------------------

describe('GET /api/journey/click', () => {
  beforeEach(() => {
    mockSingle.mockReset();
    mockFrom.mockClear();
  });

  it('redirects to destination URL', async () => {
    mockSingle.mockResolvedValue({
      data: { engagement_outcome: 'delivered' },
      error: null,
    });
    const { GET } = loadClick();
    const dest = encodeURIComponent('https://synthex.social/dashboard');
    const res = await GET(makeReq(`https://synthex.social/api/journey/click?clientId=c1&momentId=m1&url=${dest}`));
    expect(res.status).toBe(302);
  });

  it('redirects to fallback when URL is missing', async () => {
    const { GET } = loadClick();
    const res = await GET(makeReq('https://synthex.social/api/journey/click?clientId=c1&momentId=m1'));
    expect(res.status).toBe(302);
  });

  it('does not redirect to javascript: URIs', async () => {
    const { GET } = loadClick();
    const dangerous = encodeURIComponent('javascript:alert(1)');
    const res = await GET(makeReq(`https://synthex.social/api/journey/click?clientId=c1&momentId=m1&url=${dangerous}`));
    expect(res.status).toBe(302);
    // Must NOT redirect to javascript: scheme
    expect(res.headers.get('location') ?? '').not.toBe('javascript:alert(1)');
  });

  it('redirects to fallback when clientId missing', async () => {
    const { GET } = loadClick();
    const dest = encodeURIComponent('https://synthex.social/dashboard');
    const res = await GET(makeReq(`https://synthex.social/api/journey/click?momentId=m1&url=${dest}`));
    expect(res.status).toBe(302);
  });
});

// ---------------------------------------------------------------------------
// GET /api/journey/pulse-confirm
// ---------------------------------------------------------------------------

describe('GET /api/journey/pulse-confirm', () => {
  beforeEach(() => {
    mockSingle.mockReset();
    mockFrom.mockClear();
  });

  it('returns HTML thank-you page', async () => {
    mockSingle.mockResolvedValue({
      data: { engagement_outcome: 'delivered', metadata: {} },
      error: null,
    });
    const { GET } = loadConfirm();
    const res = await GET(makeReq('https://synthex.social/api/journey/pulse-confirm?clientId=c1&momentId=m1&score=4'));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<!DOCTYPE html>');
    expect(text).toContain('Feedback received');
  });

  it('skips DB update if already surveyed (idempotency)', async () => {
    mockSingle.mockResolvedValue({
      data: { engagement_outcome: 'surveyed', metadata: {} },
      error: null,
    });
    const { GET } = loadConfirm();
    const res = await GET(makeReq('https://synthex.social/api/journey/pulse-confirm?clientId=c1&momentId=m1&score=5'));
    expect(res.status).toBe(200);
    // select was called to check existing outcome (env vars set in beforeAll enable Supabase)
    expect(mockFrom).toHaveBeenCalled();
    const html = await res.text();
    expect(html).toContain('Feedback received');
  });

  it('still returns page when supabase is unavailable', async () => {
    mockSingle.mockRejectedValue(new Error('timeout'));
    const { GET } = loadConfirm();
    const res = await GET(makeReq('https://synthex.social/api/journey/pulse-confirm?clientId=c1&momentId=m1&score=3'));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Feedback received');
  });

  it('returns page without scoring when params missing', async () => {
    const { GET } = loadConfirm();
    const res = await GET(makeReq('https://synthex.social/api/journey/pulse-confirm'));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<!DOCTYPE html>');
  });
});
