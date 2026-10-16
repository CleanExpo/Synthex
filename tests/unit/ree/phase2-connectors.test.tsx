/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server';
import { generateKeyPairSync } from 'crypto';
import { getSearchAnalytics as oauth } from '@/lib/google/search-console-oauth';
import { getSearchAnalytics as legacy } from '@/lib/google/search-console';
import { POST } from '@/app/api/seo/search-console/analytics/route';
import { GET as monitor } from '@/app/api/cron/gsc-monitor/route';
import prisma from '@/lib/prisma';
import { findOAuthConnection } from '@/lib/google/google-auth';
jest.mock('@/lib/google/google-auth', () => ({
  getOAuthAccessToken: jest.fn(),
  findOAuthConnection: jest.fn(),
}));
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: async () => ({ allowed: true, context: { userId: 'u' } }),
    createSecureResponse: (data: unknown, status = 200) =>
      NextResponse.json(data, { status }),
  },
  DEFAULT_POLICIES: {},
}));
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: async () => 'org',
}));
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: () => ({ ok: true }),
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    gSCProperty: { findMany: jest.fn() },
    gSCSnapshot: { upsert: jest.fn(), findFirst: jest.fn() },
    gBPLocation: { findFirst: jest.fn(), findMany: jest.fn() },
    gBPSnapshot: { upsert: jest.fn() },
    gBPReview: { findMany: jest.fn() },
    keywordTarget: { findMany: jest.fn() },
  },
}));
const row = { clicks: 7, impressions: 80, ctr: 0.08, position: 2 };
const day = '2026-10-01';
const range = { startDate: day, endDate: day };
const respond = (data: unknown, status = 200) =>
  jest
    .mocked(fetch)
    .mockImplementation(
      async () => new Response(JSON.stringify(data), { status })
    );
beforeEach(() => {
  global.fetch = jest.fn();
  jest.mocked(findOAuthConnection).mockResolvedValue('conn');
  delete process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON;
  jest.mocked(prisma.gBPReview.findMany).mockResolvedValue([]);
  jest.mocked(prisma.keywordTarget.findMany).mockResolvedValue([]);
});
it.each([oauth, legacy])(
  'forwards image/startRow, defaults web and refuses unsupported types',
  async client => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON = JSON.stringify({
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
      client_email: 'fixture@example.test',
    });
    respond({ rows: [row], access_token: 'fixture' });
    await client(
      'https://example.test',
      { type: 'image', startRow: 25 },
      { connectionId: 'conn' }
    );
    expect(
      JSON.parse(String(jest.mocked(fetch).mock.calls.at(-1)?.[1]?.body))
    ).toMatchObject({ type: 'image', startRow: 25 });
    respond({ rows: [row], access_token: 'fixture' });
    await client('https://example.test', {}, { connectionId: 'conn' });
    expect(
      JSON.parse(String(jest.mocked(fetch).mock.calls.at(-1)?.[1]?.body)).type
    ).toBe('web');
    respond({ rows: [] });
    await expect(
      client('https://example.test', {}, { connectionId: 'conn' })
    ).rejects.toThrow();
    await expect(
      client('https://example.test', { type: 'ai' as 'web' })
    ).rejects.toMatchObject({ state: 'UNSUPPORTED' });
  }
);
it('forwards route type and reports unsupported, unavailable and no grant', async () => {
  const request = (type: string) =>
    new NextRequest('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({
        siteUrl: 'https://example.test',
        type,
        startRow: 9,
      }),
    });
  respond({ rows: [row] });
  expect((await (await POST(request('image'))).json()).type).toBe('image');
  expect(
    JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body))
  ).toMatchObject({ type: 'image', startRow: 9 });
  expect((await (await POST(request('multimodal'))).json()).state).toBe(
    'UNSUPPORTED'
  );
  respond({}, 500);
  expect((await (await POST(request('web'))).json()).state).toBe('UNAVAILABLE');
  jest.mocked(findOAuthConnection).mockResolvedValue(null);
  expect((await (await POST(request('web'))).json()).state).toBe(
    'UNAUTHORISED'
  );
});
it('persists the exact property aggregate with web-only collection', async () => {
  jest
    .mocked(prisma.gSCProperty.findMany)
    .mockResolvedValue([
      { organizationId: 'org', connectionId: 'conn', siteUrl: 'site' },
    ] as never);
  respond({ rows: [row] });
  await monitor(new NextRequest('http://localhost/api'));
  expect(
    JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body))
  ).toMatchObject({ dimensions: [], type: 'web' });
  expect(
    JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body)).rowLimit
  ).not.toBe(1);
  expect(prisma.gSCSnapshot.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      update: row,
      where: {
        organizationId_siteUrl_date: expect.objectContaining({
          organizationId: 'org',
          siteUrl: 'site',
        }),
      },
    })
  );
});
