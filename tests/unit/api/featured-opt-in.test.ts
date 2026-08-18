/**
 * Behavioural coverage for PATCH /api/clients/featured-opt-in (SYN-508).
 * Auth, Supabase, Prisma and the Slack webhook are all mocked.
 *
 * Contract: 401 no auth → 400 bad body → 404 unknown client →
 * idempotent no-op when already opted in → 200 + update + Slack alert.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

// ── Supabase mock (chainable) ────────────────────────────────────────────────
// NB: this repo's jest config sets resetMocks:true, which wipes every jest.fn
// implementation before each test — so the chain is (re)wired in beforeEach.
const maybeSingle = jest.fn();
const selectEqId = jest.fn(); // .eq('id', clientId)
const selectEqUser = jest.fn(); // .eq('user_id', userId) — tenant scope
const select = jest.fn();
const updateEqId = jest.fn(); // .eq('id', clientId)
const updateEqUser = jest.fn(); // .eq('user_id', userId) — tenant scope
const update = jest.fn();
const from = jest.fn();
jest.mock('@/lib/platform/noop-client', () => ({ createClient: () => ({ from }) }));

// ── Prisma mock (weekly digest lookup) ───────────────────────────────────────
const mockPrisma = { aIWeeklyDigest: { findFirst: jest.fn() } };
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

// ── Auth mock ────────────────────────────────────────────────────────────────
const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { PATCH } from '@/app/api/clients/featured-opt-in/route';

function req(body?: object) {
  return createMockNextRequest({
    method: 'PATCH',
    url: 'http://localhost/api/clients/featured-opt-in',
    body,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  process.env.SLACK_FEATURED_CLIENTS_WEBHOOK_URL = 'http://slack.test/hook';
  mockGetUserId.mockResolvedValue('user-1');
  mockPrisma.aIWeeklyDigest.findFirst.mockResolvedValue({
    highlights: [{ metric: 'engagement rate', value: '6.4%', change: '+18%' }],
  });
  // Re-wire the Supabase chain (resetMocks:true wipes implementations).
  // Both read and write are scoped .eq('id', ...).eq('user_id', ...) — model
  // the two-eq chain so a missing tenant predicate would fail the mock.
  maybeSingle.mockResolvedValue({ data: null, error: null });
  selectEqUser.mockReturnValue({ maybeSingle });
  selectEqId.mockReturnValue({ eq: selectEqUser });
  select.mockReturnValue({ eq: selectEqId });
  updateEqUser.mockResolvedValue({ error: null });
  updateEqId.mockReturnValue({ eq: updateEqUser });
  update.mockReturnValue({ eq: updateEqId });
  from.mockReturnValue({ select, update });
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true }) as unknown as typeof fetch;
});

describe('PATCH /api/clients/featured-opt-in', () => {
  it('401 when unauthenticated — never touches the DB', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await PATCH(req({ clientId: 'c-1' }));
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it('400 when clientId is missing', async () => {
    const res = await PATCH(req({}));
    expect(res.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it('404 when the client does not exist', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await PATCH(req({ clientId: 'missing' }));
    expect(res.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it('is idempotent — no update, no Slack when already applied', async () => {
    maybeSingle.mockResolvedValue({
      data: { id: 'c-1', name: 'Acme', featured_programme_status: 'applied' },
      error: null,
    });
    const res = await PATCH(req({ clientId: 'c-1' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ status: 'applied', alreadyOptedIn: true });
    expect(update).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('opts in: updates status to applied and fires the Slack alert', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: 'c-1',
        name: 'Acme Roofing',
        featured_programme_status: 'not_applied',
      },
      error: null,
    });

    const res = await PATCH(req({ clientId: 'c-1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ status: 'applied', alreadyOptedIn: false });

    // Wrote the new status.
    expect(update).toHaveBeenCalledWith({
      featured_programme_status: 'applied',
    });
    // Both read and write are scoped to the caller's own client row.
    expect(selectEqId).toHaveBeenCalledWith('id', 'c-1');
    expect(selectEqUser).toHaveBeenCalledWith('user_id', 'user-1');
    expect(updateEqId).toHaveBeenCalledWith('id', 'c-1');
    expect(updateEqUser).toHaveBeenCalledWith('user_id', 'user-1');

    // Slack alert fired with client name + best metric.
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://slack.test/hook');
    const payload = JSON.parse((init as RequestInit).body as string);
    expect(payload.text).toContain('Acme Roofing');
    expect(payload.text).toContain('6.4% engagement rate');
  });

  it('opt-in still succeeds when the Slack webhook is unset', async () => {
    delete process.env.SLACK_FEATURED_CLIENTS_WEBHOOK_URL;
    maybeSingle.mockResolvedValue({
      data: {
        id: 'c-1',
        name: 'Acme',
        featured_programme_status: 'not_applied',
      },
      error: null,
    });
    const res = await PATCH(req({ clientId: 'c-1' }));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
