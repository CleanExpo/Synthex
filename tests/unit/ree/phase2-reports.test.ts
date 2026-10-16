/** @jest-environment node */
import { NextRequest } from 'next/server';
import {
  ReportBuilder,
  ReportExporter as Exporter,
  PRESET_REPORTS,
  type MetricType,
} from '@/lib/analytics/report-builder';
import {
  aggregateWeeklyOutcomes,
  buildOutcomesEvent,
  renderOutcomesNote,
} from '@/lib/outcomes/weekly-digest';
import { PDFReportGenerator } from '@/lib/reports/pdf-generator';
import { POST, GET } from '@/app/api/analytics/reports/route';

const mockRows = jest.fn(),
  mockPosts = jest.fn(),
  mockCacheGet = jest.fn(),
  mockCacheSet = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    platformMetrics: { findMany: (...a: unknown[]) => mockRows(...a) },
    platformPost: { findMany: (...a: unknown[]) => mockPosts(...a) },
  },
}));
jest.mock('@/lib/cache/cache-manager', () => ({
  getCache: () => ({ get: mockCacheGet, set: mockCacheSet }),
}));
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: async () => 'u1',
}));
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: async () => 'org1',
}));
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: { check: async () => ({ allowed: true }) },
  DEFAULT_POLICIES: {},
}));
jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { log: async () => {} },
}));
const url = 'http://localhost/api/analytics/reports';
const rejects = (job: Promise<unknown>, state: string) =>
  expect(job).rejects.toMatchObject({ state });
const now = new Date('2026-10-15');
const zero = { likes: 0, comments: 0, shares: 0, impressions: 0 };
const row = () => ({ ...zero, recordedAt: now });
const build = (metrics: MetricType[] = ['impressions']) =>
  new ReportBuilder({ userId: 'u1' })
    .type('custom')
    .name('Test')
    .metrics(metrics)
    .dateRange(now, now);
const request = (extra = {}) =>
  new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify({
      dateRange: { start: '2026-10-01', end: '2026-10-15' },
      metrics: ['impressions'],
      ...extra,
    }),
  });
beforeEach(() => {
  mockRows.mockResolvedValue([row(), row()]);
  mockPosts.mockResolvedValue([]);
  mockCacheGet.mockResolvedValue(null);
});

test.each(['followers', 'conversions', 'revenue'] as MetricType[])(
  'refuses unsupported %s before read/cache, even with comparison',
  async metric => {
    await rejects(
      build([metric]).compareWith(now, now).execute(),
      'UNSUPPORTED'
    );
    expect(mockRows).not.toHaveBeenCalled();
    expect(mockCacheGet).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
  }
);
test.each(
  [[], [{ ...row(), impressions: null }], [{ ...row(), impressions: '0' }]].map(
    rows => ({ rows })
  )
)('withholds absent/malformed measurements %j', async ({ rows }) => {
  mockRows.mockResolvedValue(rows);
  await rejects(build().execute(), 'PARTIAL');
  expect(mockCacheSet).not.toHaveBeenCalled();
});
test('presets refuse unsupported reports and PDF is disabled', async () => {
  for (const preset of ['weeklyOverview', 'audienceGrowth', 'campaignROI']) {
    await rejects(
      build(PRESET_REPORTS[preset].metrics).execute(),
      'UNSUPPORTED'
    );
    const response = await GET(new NextRequest(`${url}?preset=${preset}`));
    expect(response.status).toBe(422);
  }
  expect((await POST(request({ exportFormat: 'pdf' }))).status).toBe(422);
  expect(mockRows).not.toHaveBeenCalled();
});
test('DB failure propagates despite cached success, never exports or caches', async () => {
  const report = await build().execute();
  mockCacheGet.mockResolvedValue(report);
  mockCacheSet.mockClear();
  mockRows.mockRejectedValue(new Error('private database detail'));
  await expect(build().execute()).rejects.toThrow('private database detail');
  const response = await POST(request({ exportFormat: 'csv' }));
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    state: 'UNAVAILABLE',
    data: null,
    report: null,
    value: null,
    source: 'PlatformMetrics',
  });
  expect(mockCacheSet).not.toHaveBeenCalled();
});
test('complete zero reports survive JSON/CSV; absent comparison and engagements are withheld', async () => {
  const report = await build(['impressions', 'engagements'])
    .compareWith(now, now)
    .execute();
  expect(report.data[0].metrics).toEqual({ impressions: 0, engagements: 0 });
  expect(await (await POST(request())).json()).toMatchObject({
    state: 'OBSERVED',
  });
  expect(report.summary.totals.impressions).toBe(0);
  expect(report.summary.averages.impressions).toBe(0);
  expect(report.summary.trends.impressions.changePercent).toBeNull();
  expect(report.comparison?.changes.impressions.changePercent).toBeNull();
  expect(
    JSON.parse(String((await Exporter.export(report, 'json')).content)).data[0]
      .metrics
  ).toEqual({ impressions: 0, engagements: 0 });
  expect((await Exporter.export(report, 'csv')).content).toContain(',0,0');
  await rejects(Exporter.export(report, 'pdf'), 'UNSUPPORTED');
  mockRows.mockResolvedValueOnce([row()]).mockResolvedValueOnce([]);
  await rejects(build().compareWith(now, now).execute(), 'PARTIAL');
  mockRows.mockResolvedValue([{ ...row(), likes: null }]);
  await rejects(build(['engagements']).execute(), 'PARTIAL');
});
test('measured stable percentage is zero; a single observation has no trend', async () => {
  mockRows.mockResolvedValue([
    { ...row(), impressions: 2 },
    { ...row(), impressions: 2 },
  ]);
  expect(
    (await build().compareWith(now, now).execute()).comparison?.changes
      .impressions.changePercent
  ).toBe(0);
  mockRows.mockResolvedValue([row()]);
  expect((await build().execute()).summary.trends).toEqual({});
});
test('export validates unsupported and incomplete supplied reports; route carries PARTIAL', async () => {
  const report = await build().execute();
  report.config.metrics = ['followers'];
  await rejects(Exporter.export(report, 'json'), 'UNSUPPORTED');
  report.config.metrics = ['impressions'];
  delete (report.data[0].metrics as Partial<typeof zero>).impressions;
  for (const format of ['json', 'csv'] as const)
    await rejects(Exporter.export(report, format), 'PARTIAL');
  const csv = (
    Exporter as unknown as { toCSV: (r: typeof report) => { content: string } }
  ).toCSV(report);
  expect(csv.content).toContain('Unavailable');
  mockRows.mockResolvedValue([]);
  expect(await (await POST(request())).json()).toMatchObject({
    state: 'PARTIAL',
    value: null,
    data: null,
  });
});
test('real PDF tables preserve zeros and mark missing cells unavailable', () => {
  const generator = new PDFReportGenerator();
  // Spy only on the drawing boundary; invoke the real table assembly methods.
  const doc = { autoTable: jest.fn(), lastAutoTable: { finalY: 50 } };
  Object.assign(generator, { doc });
  const tables = generator as unknown as {
    addPlatformTable: (data: object) => void;
    addDailyTable: (data: object[]) => void;
  };
  tables.addPlatformTable({ linkedin: { likes: 0 }, facebook: {} });
  tables.addDailyTable([
    { date: '2026-10-14', metrics: { likes: 0 } },
    { date: '2026-10-15', metrics: {} },
  ]);
  for (const [table] of doc.autoTable.mock.calls)
    expect(table.body.map((r: string[]) => r[1])).toEqual(['0', 'Unavailable']);
});
test.each([
  undefined,
  { ...zero, likes: null },
  { ...zero, comments: null },
  { ...zero, shares: null },
  { ...zero, impressions: null },
])(
  'digest withholds missing/mixed outcomes in note AND event: %j',
  async missing => {
    const post = (platform: string, metrics: unknown) => ({
      connection: { platform, organization: { slug: 'org' } },
      metrics: metrics ? [metrics] : [],
    });
    mockPosts.mockResolvedValue([
      post('missing', missing),
      post('mixed', zero),
      post('mixed', missing),
      post('complete', zero),
    ]);
    const outcomes = await aggregateWeeklyOutcomes(now);
    const event = buildOutcomesEvent(outcomes[0], '2026-W42');
    for (const platform of ['missing', 'mixed'])
      expect(event.byPlatform[platform]).toMatchObject({
        state: 'PARTIAL',
        value: null,
        likes: null,
        comments: null,
        shares: null,
        impressions: null,
      });
    expect(event.byPlatform.complete).toMatchObject({
      state: 'OBSERVED',
      likes: 0,
      comments: 0,
      shares: 0,
      impressions: 0,
    });
    const note = renderOutcomesNote(outcomes, '2026-W42', now);
    expect(note).toContain('mixed: 2 post(s), PARTIAL');
    expect(note).toContain('missing: 1 post(s), PARTIAL');
    expect(note).toContain(
      'complete: 1 post(s), 0 likes, 0 comments, 0 shares, 0 impressions'
    );
    mockPosts.mockRejectedValue(new Error('read failed'));
    await expect(aggregateWeeklyOutcomes(now)).rejects.toThrow('read failed');
  }
);
