/** @jest-environment node */

/**
 * Mission Control witness link: events go to
 * {UNITE_GROUP_EVENTS_URL}/api/webhooks/synthex, the last delivery outcome is
 * recorded, and GET /api/unite-group/status reports a failure instead of
 * silence. Missing env is "not configured", never "ok".
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: async () => 'owner_1',
  unauthorizedResponse: () => new Response(null, { status: 401 }),
  forbiddenResponse: () => new Response(null, { status: 403 }),
  isOwnerEmail: () => true,
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: async () => ({ email: 'owner@example.test' }) },
  },
}));

import { NextRequest } from 'next/server';

const ENV = { ...process.env };
const BASE = 'https://ug.example.test';

type Call = { url: string; init: RequestInit };
let calls: Call[];
let mockStatus: number | Error;

function load() {
  let mod!: typeof import('@/lib/unite-group-connector');
  let route!: typeof import('@/app/api/unite-group/status/route');
  jest.isolateModules(() => {
    mod = require('@/lib/unite-group-connector');
    route = require('@/app/api/unite-group/status/route');
  });
  return { ...mod, GET: route.GET };
}

async function status(GET: (r: NextRequest) => Promise<Response>) {
  const res = await GET(
    new NextRequest('http://localhost/api/unite-group/status')
  );
  return res.json();
}

beforeEach(() => {
  process.env.UNITE_GROUP_EVENTS_URL = BASE;
  process.env.UNITE_GROUP_EVENTS_API_KEY = 'test-key';
  calls = [];
  mockStatus = 202;
  global.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (mockStatus instanceof Error) throw mockStatus;
    return { status: mockStatus } as Response;
  }) as never;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  process.env = ENV;
});

const EVENT = { type: 'campaign.started', userId: 'u1', campaignId: 'c1' };

describe('pushUniteGroupEvent', () => {
  it('posts to /api/webhooks/synthex with the x-api-key header, no redirects', async () => {
    const { pushUniteGroupEvent } = load();
    await pushUniteGroupEvent(EVENT);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${BASE}/api/webhooks/synthex`);
    expect(calls[0].init).toMatchObject({
      method: 'POST',
      redirect: 'manual',
      headers: { 'x-api-key': 'test-key' },
    });
  });

  it('records a 2xx as ok and the status route reports it', async () => {
    const { pushUniteGroupEvent, getLastUniteGroupDelivery, GET } = load();
    await pushUniteGroupEvent(EVENT);
    expect(getLastUniteGroupDelivery()).toMatchObject({
      ok: true,
      statusCode: 202,
      eventType: 'campaign.started',
    });
    const body = await status(GET);
    expect(body.delivery).toMatchObject({ state: 'ok', statusCode: 202 });
  });

  it.each([307, 500])(
    'records HTTP %i as a failure surfaced by the status route',
    async code => {
      mockStatus = code;
      const { pushUniteGroupEvent, getLastUniteGroupDelivery, GET } = load();
      await expect(pushUniteGroupEvent(EVENT)).resolves.toBeUndefined();
      expect(getLastUniteGroupDelivery()).toMatchObject({
        ok: false,
        statusCode: code,
      });
      const body = await status(GET);
      expect(body.delivery).toMatchObject({
        state: 'failing',
        ok: false,
        statusCode: code,
      });
      expect(typeof body.delivery.at).toBe('string');
    }
  );

  it('records a network error as a failure', async () => {
    mockStatus = new Error('ECONNREFUSED');
    const { pushUniteGroupEvent, GET } = load();
    await expect(pushUniteGroupEvent(EVENT)).resolves.toBeUndefined();
    const body = await status(GET);
    expect(body.delivery).toMatchObject({
      state: 'failing',
      error: 'ECONNREFUSED',
    });
  });

  it('carries missionId when given', async () => {
    const { pushUniteGroupEvent } = load();
    await pushUniteGroupEvent({ ...EVENT, missionId: 'm-123' });
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      missionId: 'm-123',
      type: 'campaign.started',
      source: 'synthex',
    });
  });

  it('omits missionId otherwise', async () => {
    const { pushUniteGroupEvent } = load();
    await pushUniteGroupEvent(EVENT);
    expect(JSON.parse(String(calls[0].init.body))).not.toHaveProperty(
      'missionId'
    );
  });
});

describe('GET /api/unite-group/status delivery', () => {
  it('says not configured when env is missing, never ok', async () => {
    delete process.env.UNITE_GROUP_EVENTS_URL;
    const { pushUniteGroupEvent, GET } = load();
    await pushUniteGroupEvent(EVENT);
    expect(calls).toHaveLength(0);
    const body = await status(GET);
    expect(body.configured).toBe(false);
    expect(body.delivery).toEqual({ state: 'not_configured' });
  });

  it('says no delivery yet before any event on this instance', async () => {
    const { GET } = load();
    const body = await status(GET);
    expect(body.delivery).toEqual({ state: 'no_delivery_yet' });
  });
});
