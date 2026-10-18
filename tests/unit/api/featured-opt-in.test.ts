/**
 * Behavioural coverage for PATCH /api/clients/featured-opt-in (SYN-508).
 *
 * The opt-in flag lived on clients.featured_programme_status. prisma/schema.prisma
 * has no `clients` table, so the route must say so (501 FEATURE_NOT_PROVISIONED)
 * after auth + validation instead of claiming the opt-in was recorded.
 *
 * Contract: 401 no auth → 400 bad body → 501 not provisioned, no Slack alert.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
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
  mockGetUserId.mockResolvedValue('user-1');
  process.env.SLACK_FEATURED_CLIENTS_WEBHOOK_URL = 'http://slack.test/hook';
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true }) as unknown as typeof fetch;
});

describe('PATCH /api/clients/featured-opt-in', () => {
  it('401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await PATCH(req({ clientId: 'c-1' }));
    expect(res.status).toBe(401);
  });

  it('400 when clientId is missing', async () => {
    const res = await PATCH(req({}));
    expect(res.status).toBe(400);
  });

  it('501 FEATURE_NOT_PROVISIONED for an authenticated opt-in — no fake success, no Slack alert', async () => {
    const res = await PATCH(req({ clientId: 'c-1' }));
    const json = await res.json();
    expect(res.status).toBe(501);
    expect(json.error).toBe('FEATURE_NOT_PROVISIONED');
    expect(json.message).toMatch(/clients table/);
    expect(json).not.toHaveProperty('alreadyOptedIn');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
