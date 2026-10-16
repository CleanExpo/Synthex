/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server';
import { generateKeyPairSync } from 'crypto';
import { getInsights } from '@/lib/google/business-profile';
import { getSearchAnalytics as oauth } from '@/lib/google/search-console-oauth';
import { getSearchAnalytics as legacy } from '@/lib/google/search-console';
import { POST } from '@/app/api/seo/search-console/analytics/route';
import { GET as gbpMonitor } from '@/app/api/cron/gbp-monitor/route';
import { GET as monitor } from '@/app/api/cron/gsc-monitor/route';
import { GET as history } from '@/app/api/google-business/insights/route';
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
const metrics = [
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'WEBSITE_CLICKS',
  'CALL_CLICKS',
  'BUSINESS_DIRECTION_REQUESTS',
];
const fixture = (names = metrics) => ({
  multiDailyMetricTimeSeries: [
    {
      dailyMetricTimeSeries: names.map(dailyMetric => ({
        dailyMetric,
        timeSeries: {
          datedValues: [
            {
              date: { year: 2026, month: 10, day: 1 },
              value: dailyMetric === 'CALL_CLICKS' ? '0' : '7',
            },
          ],
        },
      })),
    },
  ],
});
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
it('uses the published GET query, both nested arrays, explicit zero and absent metrics', async () => {
  respond(fixture(['WEBSITE_CLICKS', 'CALL_CLICKS']));
  expect(
    await getInsights('conn', 'accounts/1/locations/2', range)
  ).toMatchObject({ websiteClicks: 7, phoneClicks: 0, mapsViews: undefined });
  const [url, init] = jest.mocked(fetch).mock.calls[0];
  const request = new URL(String(url));
  expect(request.pathname).toBe(
    '/v1/locations/2:fetchMultiDailyMetricsTimeSeries'
  );
  expect(init?.method).toBe('GET');
  expect(init?.body).toBeUndefined();
  expect(request.searchParams.getAll('dailyMetrics')).toEqual(metrics);
  for (const boundary of ['start_date', 'end_date'])
    for (const [part, value] of [
      ['year', '2026'],
      ['month', '10'],
      ['day', '1'],
    ])
      expect(request.searchParams.get(`dailyRange.${boundary}.${part}`)).toBe(
        value
      );
});
it.each([
  {},
  { multiDailyMetricTimeSeries: [] },
  {
    multiDailyMetricTimeSeries: [
      {
        dailyMetricTimeSeries: [
          { dailyMetric: 'CALL_CLICKS', timeSeries: { datedValues: [] } },
        ],
      },
    ],
  },
])('rejects malformed or empty series: %j', async payload => {
  respond(payload);
  await expect(getInsights('conn', 'locations/2', range)).rejects.toMatchObject(
    { state: 'UNAVAILABLE', value: null }
  );
});
it.each(['', 'abc', '1x', '-1', '9007199254740992'])(
  'rejects invalid numeric string %s',
  async value => {
    const data = fixture();
    data.multiDailyMetricTimeSeries[0].dailyMetricTimeSeries[0].timeSeries.datedValues[0].value =
      value;
    respond(data);
    await expect(
      getInsights('conn', 'locations/2', range)
    ).rejects.toMatchObject({ state: 'UNAVAILABLE' });
  }
);
it.each([401, 403, 429, 500, 0])(
  'propagates HTTP/network failure %s',
  async status => {
    if (status) respond({}, status);
    else jest.mocked(fetch).mockRejectedValue(new Error('offline'));
    await expect(
      getInsights('conn', 'locations/2', range)
    ).rejects.toMatchObject({ state: 'UNAVAILABLE' });
  }
);
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
it('quarantines historical GBP aggregates', async () => {
  jest
    .mocked(prisma.gBPLocation.findFirst)
    .mockResolvedValue({ id: 'loc' } as never);
  expect(
    await (
      await history(new NextRequest('http://localhost/api?locationId=loc'))
    ).json()
  ).toMatchObject({ state: 'PARTIAL', data: null, value: null });
  expect(prisma.gBPLocation.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'loc', organizationId: 'org' } })
  );
});

it.each([false, true])(
  'snapshots only complete daily GBP reads (valid=%s)',
  async valid => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-03T10:00:00Z'));
    try {
      jest
        .mocked(prisma.gBPLocation.findMany)
        .mockResolvedValueOnce([
          { id: 'loc', locationId: 'locations/2', organizationId: 'org' },
        ] as never)
        .mockResolvedValue([]);
      respond(valid ? fixture() : fixture(['CALL_CLICKS']));
      await gbpMonitor(new NextRequest('http://localhost/api'));
      const url = new URL(String(jest.mocked(fetch).mock.calls[0][0]));
      for (const boundary of ['start_date', 'end_date']) {
        expect(url.searchParams.get(`dailyRange.${boundary}.day`)).toBe('1');
      }
      if (valid)
        expect(prisma.gBPSnapshot.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              organizationId_locationId_date: expect.objectContaining({
                organizationId: 'org',
                locationId: 'loc',
              }),
            },
            update: expect.objectContaining({
              phoneClicks: 0,
              websiteClicks: 7,
            }),
          })
        );
      else expect(prisma.gBPSnapshot.upsert).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  }
);
it('refuses missing dates, malformed shapes and multiple ambiguous series', async () => {
  const missing = fixture();
  const extra = fixture();
  extra.multiDailyMetricTimeSeries.push(extra.multiDailyMetricTimeSeries[0]);
  respond(missing);
  await expect(
    getInsights('conn', 'locations/2', {
      startDate: day,
      endDate: '2026-10-02',
    })
  ).rejects.toMatchObject({ state: 'UNAVAILABLE' });
  // Single-day range so every series is otherwise complete: only the
  // duplicated metric can make this read fail.
  respond(extra);
  await expect(getInsights('conn', 'locations/2', range)).rejects.toMatchObject(
    { state: 'UNAVAILABLE' }
  );
});
