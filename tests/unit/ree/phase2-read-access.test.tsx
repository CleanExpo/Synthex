import React from 'react';
import * as ui from '@testing-library/react';
import { SWRConfig } from 'swr';
import { NextRequest, NextResponse } from 'next/server';
import { observed, notObserved } from '@/lib/ree/evidence-state';
const SOURCE = 'GEOAnalysis:personal';
const fetchMock = jest.fn();
const db = jest.fn(),
  auth = jest.fn(),
  security = jest.fn(),
  plan = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: { gEOAnalysis: { findMany: (...a: unknown[]) => db(...a) } },
}));
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: () => auth(),
}));
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...a: unknown[]) => security(...a),
    createSecureResponse: (body: unknown, status = 200) =>
      NextResponse.json(body, { status }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: 'read',
    AUTHENTICATED_WRITE: 'write',
  },
}));
jest.mock('@/lib/stripe/subscription-service', () => ({
  subscriptionService: { getOrCreateSubscription: () => plan() },
}));
jest.mock('@/hooks/use-user', () => ({
  useUser: () => ({ user: { id: 'operator' }, isLoading: false }),
}));
import { GET as history } from '@/app/api/seo/geo-readiness/history/route';
import { GET as trends } from '@/app/api/seo/geo-readiness/trends/route';
import { GET as score } from '@/app/api/dashboard/geo-score/route';
import * as clients from '@/app/api/clients/route';
import { useGeoReadiness } from '@/hooks/useGeoReadiness';
import ReadinessPage from '@/app/dashboard/seo/geo-readiness/page';
import ScorePage from '@/app/dashboard/geo-score/page';
import AdvisorPage from '@/app/dashboard/advisor/page';
import ClientsPage from '@/app/dashboard/clients/page';
const unavailable = notObserved('UNAVAILABLE', SOURCE, 'Read failed');
const unsupported = {
  ...notObserved('UNSUPPORTED', 'legacy', 'Not available'),
  score: 0,
  trend_data: [],
  recommended_actions: [],
  computed_at: '2026-10-16',
};
const zero = {
  id: 1,
  contentUrl: null,
  platform: 'all',
  overallScore: 0,
  citabilityScore: 0,
  structureScore: 0,
  multiModalScore: 0,
  authorityScore: 0,
  technicalScore: 0,
  createdAt: new Date('2026-10-16'),
};
const request = (org = 'a') =>
  new NextRequest(`http://localhost/api/test?organizationId=${org}`);
const response = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: async () => body,
  } as Response);
function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: () => new Map(),
        shouldRetryOnError: false,
        dedupingInterval: 0,
      }}
    >
      {children}
    </SWRConfig>
  );
}
beforeEach(() => {
  db.mockResolvedValue([]);
  auth.mockResolvedValue('operator');
  plan.mockResolvedValue({ plan: 'professional' });
  security.mockResolvedValue({
    allowed: true,
    context: { userId: 'operator' },
  });
  global.fetch = fetchMock;
  fetchMock.mockImplementation(() => response(unsupported, 501));
});
test.each([history, trends])('personal read states', async route => {
  const random = jest.spyOn(Math, 'random');
  for (const org of ['a', 'b']) {
    const context = { userId: 'operator', organizationId: org };
    security.mockResolvedValue({ allowed: true, context });
    const res = await route(request(org));
    expect(res.status).toBe(200);
    const reading = await res.json();
    expect(reading.state).toBe('OBSERVED');
    expect(reading.source).toBe(SOURCE);
    expect(reading.value.analyses ?? reading.value.trends).toEqual([]);
    expect(db.mock.lastCall[0].where).toMatchObject({ userId: 'operator' });
    expect(db.mock.lastCall[0].where).not.toHaveProperty('user');
    expect(db.mock.lastCall[0].where).not.toHaveProperty('organizationId');
  }
  expect(random).not.toHaveBeenCalled();
  db.mockResolvedValue([zero]);
  const measured = await (await route(request())).json();
  expect(
    measured.value.analyses?.[0].overallScore ??
      measured.value.trends?.[0].overall
  ).toBe(0);
  db.mockRejectedValue(new Error('private database error'));
  const failed = await route(request());
  expect(failed.status).toBe(503);
  expect(await failed.json()).toMatchObject({
    state: 'UNAVAILABLE',
    value: null,
  });
});
test.each([
  ['score', score],
  ['GET', clients.GET],
  ['POST', clients.POST],
  ['PUT', clients.PUT],
  ['DELETE', clients.DELETE],
] as const)('%s: auth then unsupported (real noop)', async (verb, route) => {
  const res = await route(request());
  expect(res.status).toBe(501);
  expect(await res.json()).toMatchObject({
    state: 'UNSUPPORTED',
    value: null,
    reason: expect.any(String),
  });
  if (verb !== 'score')
    expect(security.mock.lastCall[1]).toBe(verb === 'GET' ? 'read' : 'write');
  auth.mockResolvedValue(null);
  security.mockResolvedValue({
    allowed: false,
    error: 'Authentication required',
  });
  expect((await route(request())).status).toBe(verb === 'score' ? 401 : 403);
});
test('failed refresh', async () => {
  const data = observed(
    { analyses: [zero], trends: [{ overall: 0 }], total: 1 },
    SOURCE
  );
  fetchMock.mockImplementation(() => response(data));
  const { result } = ui.renderHook(useGeoReadiness, { wrapper });
  await ui.waitFor(() => expect(result.current.history.state).toBe('OBSERVED'));
  expect(result.current.history.value?.analyses[0].overallScore).toBe(0);
  fetchMock.mockImplementation(() => response(unavailable, 503));
  await ui.act(async () => {
    await result.current.loadHistory();
    await result.current.loadTrends();
  });
  expect(result.current.history).toEqual(unavailable);
  expect(result.current.trends).toEqual(unavailable);
  expect(result.current.historyError).toBeTruthy();
  expect(result.current.trendsError).toBeTruthy();
});
test.each([false, true])('readiness UI (%s)', async failed => {
  const empty = observed({ analyses: [], trends: [] }, SOURCE);
  fetchMock.mockImplementation(url =>
    String(url).includes('subscription')
      ? response({ plan: 'professional', limits: {}, usage: {} })
      : response(failed ? unavailable : empty, failed ? 503 : 200)
  );
  ui.render(<ReadinessPage />, { wrapper });
  expect(ui.screen.getByText(/Personal DIAGNOSTIC/)).toHaveTextContent(
    'not search visibility'
  );
  ui.fireEvent.click(await ui.screen.findByText('History · DIAGNOSTIC'));
  expect(
    await ui.screen.findByText(
      failed ? /history unavailable/ : 'No analysis history'
    )
  ).toBeVisible();
  ui.fireEvent.click(ui.screen.getByText('Trends · DIAGNOSTIC'));
  expect(
    await ui.screen.findByText(
      failed ? /trends unavailable/ : 'No trend data yet'
    )
  ).toBeVisible();
});
test.each([ScorePage, AdvisorPage, ClientsPage])('legacy UI', async Page => {
  fetchMock.mockImplementation(url =>
    String(url).includes('/advisor/brief')
      ? response({
          brief: {
            id: 'brief',
            weekStart: '2026-10-12',
            actions: [],
            geoTeaserText: 'Legacy score',
            dollarAttribution: '',
          },
        })
      : response(unsupported, 501)
  );
  ui.render(<Page />, { wrapper });
  expect(
    await ui.screen.findByText(
      /GEO score not available|Clients unavailable/,
      {},
      { timeout: 10000 }
    )
  ).toBeVisible();
  expect(ui.screen.queryByText(/calculating|No clients yet/i)).toBeNull();
});
