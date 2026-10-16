/** @jest-environment node */
import React from 'react';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { SWRConfig } from 'swr';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromCookies } from '@/lib/auth/jwt-utils';
import { verifyAdmin } from '@/lib/admin/verify-admin';
import { trackPipelineCost } from '@/lib/pipelines/track-cost';
import { GET } from '@/app/api/admin/geo-citations/route';
import AdminPage from '@/app/dashboard/admin/geo-citations/page';
import AeoPage from '@/app/dashboard/aeo/page';
import { execute } from '@/lib/workflow/step-types/action-schedule';
import type { StepContext } from '@/lib/workflow/types';
import * as adapter from '@/lib/geo-citation/ai-overview-adapter';
import { runWeeklyGeoCitationMonitor as monitor } from '@/lib/geo-citation/run-weekly-monitor';
import { buildHyperCareSnapshot } from '@/lib/agency/hypercare-snapshot';
import { buildTier2Snapshot } from '@/lib/agency/tier2-snapshot';
jest.mock('@/lib/prisma', () => {
  const db = new Proxy(
    {},
    {
      get: (db: Record<string, unknown>, key: string) =>
        (db[key] ??= {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          create: jest.fn(),
          count: jest.fn(),
          groupBy: jest.fn(),
        }),
    }
  );
  return { __esModule: true, default: db, prisma: db };
});
jest.mock('@/lib/auth/jwt-utils', () => ({ getUserIdFromCookies: jest.fn() }));
jest.mock('@/lib/admin/verify-admin', () => ({ verifyAdmin: jest.fn() }));
jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: jest.fn(),
}));
jest.mock('@/lib/email/index', () => ({ email: { send: jest.fn() } }));
const db = prisma as unknown as Record<string, Record<string, jest.Mock>>;
const step = { name: 'schedule' } as StepContext['stepDefinition'];
const context = (organizationId?: string, campaignId?: string) =>
  ({
    organizationId,
    workflowInput: { campaignId, userId: 'attacker', organizationId: 'B' },
    priorOutputs: [],
  }) as unknown as StepContext;
const read = async (query = '') => {
  const request = new NextRequest(
    `http://localhost/api/admin/geo-citations${query}`
  );
  return (await GET(request)).json();
};
const admin = (data: unknown) =>
  html(
    <SWRConfig value={{ fallbackData: data, revalidateOnMount: false }}>
      <AdminPage />
    </SWRConfig>
  );
beforeEach(() => {
  jest.mocked(verifyAdmin).mockResolvedValue({ isAdmin: true });
  jest.mocked(getUserIdFromCookies).mockResolvedValue('owner');
  db.geoCitationEvent.findMany.mockResolvedValue([]);
  db.geoCitationEvent.count.mockResolvedValue(0);
  db.user.findMany.mockResolvedValue([{ id: 'owner', organizationId: 'A' }]);
  db.gBPLocation.findMany.mockResolvedValue([
    {
      organizationId: 'A',
      categories: { primaryCategory: 'Plumber' },
      address: { locality: 'Brisbane' },
    },
  ]);
  db.organization.findUnique.mockResolvedValue({ status: 'active' });
  db.businessOwnership.findUnique.mockResolvedValue({ isActive: true });
  db.user.findUnique.mockResolvedValue({ organizationId: 'A' });
  db.report.findFirst.mockResolvedValue(null);
  db.post.create.mockResolvedValue({ id: 'post' });
});
it('credentials cannot connect the default adapter or trigger network I/O', async () => {
  const original = process.env;
  const fetch = jest.spyOn(global, 'fetch');
  try {
    for (const value of ['', 'present']) {
      process.env = {
        ...original,
        DATAFORSEO_LOGIN: value,
        DATAFORSEO_PASSWORD: value,
        SERPAPI_KEY: value,
        SERP_PROVIDER: value,
      };
      expect(adapter.isAiOverviewProviderConfigured()).toBe(false);
      expect(
        (await adapter.defaultAiOverviewFetcher('plumber')).configured
      ).toBe(false);
    }
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    process.env = original;
    fetch.mockRestore();
  }
});
it.each([false, true])('connection %s and currency', async configured => {
  const fetcher = async () => ({
    configured,
    rawText: 'Other business',
    errorReason: null,
  });
  const summary = await monitor({ fetcher, skipRateLimit: true });
  expect(summary.providerConfigured).toBe(configured);
  expect(summary.estimatedCostAud).toBe(configured ? 0.03 : 0);
  expect(trackPipelineCost).toHaveBeenCalledTimes(configured ? 0 : 1);
});
it.each(['true', 'false'])('observed %s filter', async mentioned => {
  await read(`?mentioned=${mentioned}`);
  expect(db.geoCitationEvent.findMany.mock.calls[0][0].where).toEqual({
    brandMentioned: mentioned === 'true',
    errorReason: null,
  });
});
it('renders disconnected empty data and null failure mentions, preserving observed false', async () => {
  const empty = await read();
  expect(empty.provider).toMatchObject({ state: 'UNSUPPORTED', value: null });
  expect(admin(empty)).toContain('AI Overview provider not connected.');
  const reasons = [
    adapter.AI_OVERVIEW_NOT_CONFIGURED_REASON,
    'provider_not_connected',
    'provider_error',
    'rate_limited',
    'fetch_failed',
    null,
  ];
  db.geoCitationEvent.findMany.mockResolvedValue(
    reasons.map((errorReason, id) => ({
      id,
      errorReason,
      brandMentioned: false,
      searchEngine: 'google_ai_overview',
    }))
  );
  const data = await read();
  expect(
    data.rows.map((r: { brandMentioned: unknown }) => r.brandMentioned)
  ).toEqual([null, null, null, null, null, false]);
  const states =
    'UNSUPPORTED UNSUPPORTED UNAVAILABLE UNAVAILABLE UNAVAILABLE OBSERVED';
  expect(data.rows.map((r: { state: string }) => r.state).join(' ')).toBe(
    states
  );
  expect(data.rows[0]).toMatchObject({
    reason: 'provider_not_connected',
    value: null,
  });
  expect(admin(data).match(/>No</g)).toHaveLength(1);
  expect(admin(data).match(/>Unavailable</g)).toHaveLength(3);
});
it.each([undefined, 'campaign'])('schedule %s binds org', async campaignId => {
  db.campaign.findFirst.mockResolvedValue({
    id: 'safe',
    organizationId: 'A',
  });
  expect((await execute(step, context('A', campaignId))).success).toBe(true);
  expect(db.campaign.findFirst.mock.calls[0][0].where).toEqual(
    campaignId
      ? { id: campaignId, organizationId: 'A' }
      : { organizationId: 'A' }
  );
  db.post.create.mockClear();
  db.campaign.findFirst.mockResolvedValue({
    id: 'foreign',
    organizationId: 'B',
  });
  expect((await execute(step, context('A', campaignId))).success).toBe(false);
  expect(db.post.create).not.toHaveBeenCalled();
});
it('refuses missing trusted org despite input/config identities', async () => {
  const config = { userId: 'owner', organizationId: 'B' };
  const result = await execute({ ...step, config }, context());
  expect(result.success).toBe(false);
  expect(db.campaign.findFirst).not.toHaveBeenCalled();
  expect(db.post.create).not.toHaveBeenCalled();
});
it('scopes two users and the same owner switching org; retains measured zero', async () => {
  db.report.findFirst.mockImplementation(async ({ where }) => ({
    data: {
      ...(where.type === 'agency_tier2'
        ? buildTier2Snapshot([])
        : buildHyperCareSnapshot([])),
      failureReasons: [{ reason: `only-${where.organizationId}`, count: 0 }],
    },
  }));
  for (const [user, active] of [
    ['owner', 'A'],
    ['other', 'B'],
    ['owner', 'B'],
  ]) {
    jest.mocked(getUserIdFromCookies).mockResolvedValue(user);
    db.user.findUnique.mockResolvedValue({
      organizationId: 'A',
      activeOrganizationId: active,
      isMultiBusinessOwner: true,
    });
    const page = html(await AeoPage());
    expect(page).toContain(`only-${active}`);
    expect(page).not.toContain(`only-${active === 'A' ? 'B' : 'A'}`);
    expect(page).toContain('>0</td>');
    expect(page).toContain(
      'Not available until brand-to-organisation mapping is approved.'
    );
    expect(db.aeoGateRun.groupBy).not.toHaveBeenCalled();
  }
});
it.each(['report', 'user'])('%s failure is unavailable', async model => {
  db[model][model === 'report' ? 'findFirst' : 'findUnique'].mockRejectedValue(
    new Error('DB failed')
  );
  const page = html(await AeoPage());
  expect(page).toContain('Snapshot unavailable: read failed.');
  expect(page).not.toMatch(/missing or invalid|>0</);
});
it('distinguishes missing snapshots and refuses unauthenticated report reads', async () => {
  expect(html(await AeoPage())).toContain(
    'Snapshot unavailable: missing or invalid data.'
  );
  db.report.findFirst.mockClear();
  jest.mocked(getUserIdFromCookies).mockResolvedValue(null);
  expect(html(await AeoPage())).toContain(
    'Organisation context not available.'
  );
  expect(db.report.findFirst).not.toHaveBeenCalled();
  expect(db.aeoGateRun.groupBy).not.toHaveBeenCalled();
});
