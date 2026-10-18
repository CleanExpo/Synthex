/**
 * /api/backup — NOT PROVISIONED (system_backups, profiles, content_posts have
 * no model in prisma/schema.prisma). Auth still gates both handlers; an
 * authorised caller gets 501 FEATURE_NOT_PROVISIONED, never a fake
 * "success: true" backup or an empty history list.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { GET, POST } from '@/app/api/backup/route';

const ORIGINAL = {
  cron: process.env.CRON_SECRET,
  admin: process.env.ADMIN_API_KEY,
};

beforeEach(() => {
  process.env.CRON_SECRET = 'cron-secret-test';
  process.env.ADMIN_API_KEY = 'admin-key-test';
});

afterAll(() => {
  process.env.CRON_SECRET = ORIGINAL.cron;
  process.env.ADMIN_API_KEY = ORIGINAL.admin;
});

const URL_ = 'http://localhost/api/backup';

describe('POST /api/backup', () => {
  it('401 without the cron secret', async () => {
    const res = await POST(
      createMockNextRequest({ method: 'POST', url: URL_, body: {} })
    );
    expect(res.status).toBe(401);
  });

  it('400 on unexpected body fields', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: URL_,
        headers: { authorization: 'Bearer cron-secret-test' },
        body: { bogus: true },
      })
    );
    expect(res.status).toBe(400);
  });

  it('501 FEATURE_NOT_PROVISIONED for an authorised run — no fake success', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: URL_,
        headers: { authorization: 'Bearer cron-secret-test' },
        body: {},
      })
    );
    const json = await res.json();
    expect(res.status).toBe(501);
    expect(json.error).toBe('FEATURE_NOT_PROVISIONED');
    expect(json.message).toMatch(/system_backups/);
    expect(json).not.toHaveProperty('success');
  });
});

describe('GET /api/backup', () => {
  it('401 without admin or cron credentials', async () => {
    const res = await GET(createMockNextRequest({ url: URL_ }));
    expect(res.status).toBe(401);
  });

  it('501 available:false for an admin read — never an empty backups list', async () => {
    const res = await GET(
      createMockNextRequest({
        url: URL_,
        headers: { 'x-admin-api-key': 'admin-key-test' },
      })
    );
    const json = await res.json();
    expect(res.status).toBe(501);
    expect(json).toMatchObject({
      error: 'FEATURE_NOT_PROVISIONED',
      available: false,
    });
    expect(json.reason).toMatch(/system_backups/);
    expect(json).not.toHaveProperty('backups');
  });
});
