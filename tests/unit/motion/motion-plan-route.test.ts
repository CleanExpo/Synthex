/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/brand-video/motion-plan/route';
import { withRateLimit } from '@/lib/rate-limit';

let mockUserId: string | null = 'user-1';
jest.mock('@/lib/auth/with-auth', () => ({
  withAuth:
    (handler: (req: unknown, ctx: unknown) => unknown) =>
    async (req: unknown) =>
      mockUserId
        ? handler(req, { userId: mockUserId, clientId: 'org-1', role: 'owner' })
        : (await import('next/server')).NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          ),
}));
jest.mock('@/lib/rate-limit', () => ({ withRateLimit: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: new Proxy(
    {},
    {
      get: () => {
        throw new Error('no DB access expected');
      },
    }
  ),
}));

const SOURCE =
  'Crews dried 42 homes last month. Arrival time fell from 90 to 38 minutes. We answer 24/7.';
const good = {
  brand: 'dr',
  placement: 'youtube',
  durationSeconds: 20,
  audience: 'Brisbane homeowners',
  headline: 'Help in under an hour',
  cta: 'Call 24/7',
  source: SOURCE,
  content: {
    kind: 'stat',
    stat: '38 minutes',
    label: 'Average arrival',
    context: 'Down from 90 minutes',
  },
};
const post = (body: unknown) =>
  POST(
    new NextRequest('http://localhost/api/brand-video/motion-plan', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );

let fetchSpy: jest.SpyInstance;
beforeEach(() => {
  mockUserId = 'user-1';
  jest
    .mocked(withRateLimit)
    .mockImplementation(async (_req, handler) => handler());
  fetchSpy = jest
    .spyOn(global, 'fetch')
    .mockRejectedValue(new Error('no network expected'));
});
afterEach(() => fetchSpy.mockRestore());

describe('POST /api/brand-video/motion-plan', () => {
  it('refuses unauthenticated callers', async () => {
    mockUserId = null;
    expect((await post(good)).status).toBe(401);
  });

  it('returns a plan, house style and Claude Motion brief without network, DB or render', async () => {
    const res = await post(good);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan.compositionId).toBe('MotionStudio');
    expect(body.plan.props.beats[0]).toMatchObject({
      kind: 'headline',
      text: 'Help in under an hour',
    });
    expect(body.plan.factCheck.ok).toBe(true);
    expect(body.houseStyle.slug).toBe('dr');
    expect(body.claudeMotionBrief).toContain(
      'Source (the only place facts may come from):'
    );
    expect(body.next).toMatch(/human approves before export/);
    expect(withRateLimit).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks an invented number with 422 UNSUPPORTED', async () => {
    const res = await post({
      ...good,
      content: { ...good.content, stat: '20 minutes' },
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.state).toBe('UNSUPPORTED');
    expect(body.factCheck.unsupported).toEqual(['20']);
    expect(body.plan).toBeUndefined();
  });

  it('reports non-fact problems as PARTIAL with 422', async () => {
    const res = await post({
      ...good,
      placement: 'feed-portrait',
      headline: 'Our crews arrive fast with every piece of drying gear',
    });
    expect(res.status).toBe(422);
    expect((await res.json()).state).toBe('PARTIAL');
  });

  it('refuses unknown brands via the brand preflight', async () => {
    const res = await post({ ...good, brand: 'Coca-Cola' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Brand preflight failed');
  });

  it('plans a green-screen overlay for keying over real footage', async () => {
    const res = await post({ ...good, placement: 'overlay-green' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan.props.style).toMatchObject({
      background: '#00B140',
      chromaKey: true,
    });
    expect(body.claudeMotionBrief).toContain('solid green #00B140');
  });

  it('requires a headline', async () => {
    const { headline: _omit, ...noHeadline } = good;
    expect((await post(noHeadline)).status).toBe(400);
  });

  it('validates the brief', async () => {
    const res = await post({ ...good, durationSeconds: 600 });
    expect(res.status).toBe(400);
  });
});
