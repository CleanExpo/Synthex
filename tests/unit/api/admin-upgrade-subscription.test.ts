/**
 * Behavioral coverage for /api/admin/upgrade-subscription (SYN-1000).
 * This route can grant any user a paid plan — the admin gate is the only thing
 * standing between an anonymous caller and a free subscription upgrade.
 *
 * This route uses its OWN inline verifyAdmin (x-admin-api-key OR admin JWT),
 * not the shared lib helper. We prove the gate without reaching Supabase:
 *   - no credentials            → 403 (returns before any Supabase call)
 *   - valid admin key, bad body → 400 (validation before any Supabase call)
 * The 200 path writes through the Supabase service-role client and is covered
 * by integration tests, not this unit gate.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

import { POST } from '@/app/api/admin/upgrade-subscription/route';

const ORIGINAL_ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const TEST_ADMIN_KEY = 'test-admin-key-syn1000';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
});

afterAll(() => {
  process.env.ADMIN_API_KEY = ORIGINAL_ADMIN_API_KEY;
});

describe('POST /api/admin/upgrade-subscription — admin gate (SYN-1000)', () => {
  it('returns 403 when no admin credentials are supplied', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/admin/upgrade-subscription',
        body: { email: 'user@example.com', plan: 'pro' },
      })
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 for an admin (valid api key) sending an invalid plan', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/admin/upgrade-subscription',
        headers: { 'x-admin-api-key': TEST_ADMIN_KEY },
        body: { email: 'user@example.com', plan: 'not-a-real-plan' },
      })
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for an admin (valid api key) sending a malformed email', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/admin/upgrade-subscription',
        headers: { 'x-admin-api-key': TEST_ADMIN_KEY },
        body: { email: 'not-an-email', plan: 'pro' },
      })
    );
    expect(res.status).toBe(400);
  });

  it('rejects a wrong admin api key with 403', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/admin/upgrade-subscription',
        headers: { 'x-admin-api-key': 'wrong-key-wrong-length-too' },
        body: { email: 'user@example.com', plan: 'pro' },
      })
    );
    expect(res.status).toBe(403);
  });
});
