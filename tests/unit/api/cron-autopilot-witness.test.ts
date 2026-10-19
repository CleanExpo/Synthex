/**
 * /api/cron/autopilot — Mission Control witness (SPM G3, A-25 / AM-6).
 *
 * A post autopilot writes is drafted and, under HOLD_FOR_REVIEW, held: one
 * synthex.drafted and one synthex.held per post, after the write, without a
 * missionId (autopilot is cron-started). A failing connector never fails the
 * run. The connector is real; only fetch is replaced.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

type Sent = Record<string, unknown>;
let sent: Sent[] = [];
let fetchFails = false;
async function fakeFetch(_url: string, init: { body: string }) {
  if (fetchFails) throw new Error('connect ECONNREFUSED');
  sent.push(JSON.parse(init.body) as Sent);
  return { status: 200 } as Response;
}

let runUpdates: Array<{ data: Record<string, unknown> }> = [];
jest.mock('@/lib/prisma', () => {
  const client = {
    autopilotConfig: {
      findMany: async () => [
        {
          id: 'cfg-dr',
          organizationId: 'org-dr',
          enabled: true,
          enabledPlatforms: ['linkedin'],
          planningHorizonDays: 1,
          postsPerDayPerPlatform: 1,
          contentMix: {},
          autoApproveThreshold: 100,
          minScoreThreshold: 65,
          organization: {
            id: 'org-dr',
            name: 'Disaster Recovery',
            industry: 'restoration',
            brandDna: null,
            users: [{ id: 'user-1' }],
            teamMembers: [{ userId: 'user-1', role: 'owner' }],
          },
        },
      ],
      update: async () => ({}),
    },
    autopilotRun: {
      create: async () => ({ id: 'run-1' }),
      update: async (args: { data: Record<string, unknown> }) => {
        runUpdates.push(args);
        return {};
      },
      updateMany: async () => ({ count: 1 }),
    },
    campaign: {
      findFirst: async () => ({ id: 'camp-1' }),
      create: async () => ({ id: 'camp-1' }),
    },
    post: { create: async () => ({ id: 'post-1' }) },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: () => ({ ok: true }),
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
}));
jest.mock('@/lib/autopilot/daily-planner', () => ({
  planDailyContent: async () => ({
    slots: [
      {
        platform: 'linkedin',
        date: new Date('2026-10-20T00:00:00Z'),
        theme: 'educational',
      },
    ],
  }),
}));
jest.mock('@/lib/ai/content-generator', () => ({
  AIContentGenerator: class {
    generateContent = async () => ({ content: 'Generated copy.' });
  },
}));
jest.mock('@/lib/autopilot/quality-gate', () => ({
  // 'schedule' is the load-bearing case: the hold still makes it a draft.
  evaluateContent: () => ({ decision: 'schedule', score: 90 }),
  scoreDimensions: () => ({ engagement: 70 }),
}));
jest.mock('@/lib/ml/posting-time-predictor', () => ({
  postingTimePredictor: {
    getOptimalTimes: async () => ({ topSlot: { hour: 9 } }),
  },
}));
jest.mock('@/lib/autopilot/grounded-post-image', () => ({
  attachGroundedImage: async () => ({ status: 'draft', images: [], meta: {} }),
}));

import { GET } from '@/app/api/cron/autopilot/route';
import { getLastUniteGroupDelivery } from '@/lib/unite-group-connector';

const realFetch = global.fetch;
const realConsoleError = console.error;
const req = () =>
  createMockNextRequest({ url: 'http://localhost/api/cron/autopilot' });
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const witness = () =>
  sent.filter(event => String(event.type).startsWith('synthex.'));

beforeEach(() => {
  sent = [];
  runUpdates = [];
  fetchFails = false;
  process.env.UNITE_GROUP_EVENTS_URL = 'https://unite.example';
  process.env.UNITE_GROUP_EVENTS_API_KEY = 'test-key';
  global.fetch = fakeFetch as unknown as typeof fetch;
  console.error = () => undefined;
});

afterAll(() => {
  global.fetch = realFetch;
  console.error = realConsoleError;
  delete process.env.UNITE_GROUP_EVENTS_URL;
  delete process.env.UNITE_GROUP_EVENTS_API_KEY;
});

describe('autopilot witness events', () => {
  it('emits one drafted and one held for the written post, without missionId', async () => {
    const res = await GET(req());
    await settle();

    expect(res.status).toBe(200);
    expect(witness().map(event => event.type)).toEqual([
      'synthex.drafted',
      'synthex.held',
    ]);
    for (const event of witness()) {
      expect(event).toMatchObject({
        id: 'post-1',
        kind: 'post',
        organizationId: 'org-dr',
      });
      expect(event).not.toHaveProperty('missionId');
    }
  });

  it('a failing connector does not fail the run, and the failure is recorded', async () => {
    fetchFails = true;

    const res = await GET(req());
    await settle();

    expect(res.status).toBe(200);
    const terminal = runUpdates[runUpdates.length - 1];
    expect(terminal.data.status).toBe('completed');
    expect(terminal.data.postsGenerated).toBe(1);
    expect(getLastUniteGroupDelivery()).toMatchObject({
      ok: false,
      eventType: 'synthex.held',
      error: 'connect ECONNREFUSED',
    });
  });
});
