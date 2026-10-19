/**
 * Mission Control witness events (SPM audit G3, DECISIONS A-25 / AM-6).
 *
 * Each step of a marketing job — planned, drafted, held, approved — emits one
 * `synthex.<step>` event through the existing Unite-Group connector, after the
 * step succeeded. missionId rides only when Mission Control started the work.
 * A failing connector never fails the user's action and is recorded as the
 * last delivery outcome.
 *
 * The connector is real; only `fetch` is replaced, so these tests see the
 * exact bodies Unite-Group would receive.
 */

import type { Prisma } from '@prisma/client';
import { createMockNextRequest } from '../../helpers/mock-request';

// ── Plain-function mocks (jest config resets jest.fn implementations) ───────

type Sent = Record<string, unknown>;
let sent: Sent[] = [];
let fetchMode: 'ok' | 'network_error' | 'http_500' = 'ok';
async function fakeFetch(_url: string, init: { body: string }) {
  if (fetchMode === 'network_error') throw new Error('connect ECONNREFUSED');
  sent.push(JSON.parse(init.body) as Sent);
  return { status: fetchMode === 'http_500' ? 500 : 200 } as Response;
}

let createdCampaign: Record<string, unknown> = {};
jest.mock('@/lib/prisma', () => {
  const client = {
    $transaction: async (
      fn: (tx: unknown) => Promise<unknown>
    ): Promise<unknown> =>
      fn({
        campaign: { create: async () => createdCampaign },
        auditLog: { create: async () => ({}) },
      }),
    studioContentDraft: {},
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveQueryFilter: async () => ({ userId: 'user-1' }),
  resolveCampaignOrganizationId: async () => 'org-1',
  OrgAccessError: class OrgAccessError extends Error {},
}));
jest.mock('@/lib/redis-client', () => ({
  getRedisClient: () => ({
    keys: async () => [],
    del: async () => 0,
    get: async () => null,
    set: async () => undefined,
  }),
}));
jest.mock('@/lib/rate-limit', () => ({
  writeDefault: (_req: unknown, handler: () => Promise<unknown>) => handler(),
}));
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: async () => 'user-1',
  unauthorizedResponse: () => new Response(null, { status: 401 }),
}));
jest.mock('@/lib/social', () => ({
  isPlatformSupported: (platform: string) => platform === 'linkedin',
}));
jest.mock('@/lib/social/schedule-via-post', () => ({
  scheduleViaPost: async () => {
    throw new Error('not used');
  },
}));
jest.mock('@/lib/publish/safetyChecks', () => ({
  resolveOrgAutoPublishGate: async () => ({ allowed: true }),
}));
jest.mock('@/lib/observability/error-tracker', () => ({
  trackError: () => undefined,
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
}));

import { POST as createCampaign } from '@/app/api/campaigns/route';
import {
  saveStudioDraft,
  type StudioDraftDelegate,
} from '@/lib/marketing-agency/studio/draft-store';
import {
  approveAndScheduleStudioDraft,
  type StudioTransactionRunner,
} from '@/lib/marketing-agency/studio/approve-and-schedule';
import { witnessAutopilotPost } from '@/lib/autopilot/hold-for-review';
import { getLastUniteGroupDelivery } from '@/lib/unite-group-connector';

const realFetch = global.fetch;
const realConsoleError = console.error;

beforeEach(() => {
  sent = [];
  fetchMode = 'ok';
  createdCampaign = {
    id: 'camp-1',
    name: 'Spring',
    organizationId: 'org-1',
    status: 'draft',
  };
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

/** Emission is fire-and-forget; let the pending fetches settle. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

const ofType = (type: string) => sent.filter(event => event.type === type);
// Post lifecycle events (post.*) ride the same saves; see post-lifecycle-events.test.ts.
const witness = () =>
  sent.filter(event => String(event.type).startsWith('synthex.'));

// ── planned: POST /api/campaigns ────────────────────────────────────────────

function campaignRequest(body: Record<string, unknown>) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost:3000/api/campaigns',
    body: { name: 'Spring', platform: 'linkedin', ...body },
  });
}

describe('planned — campaign create', () => {
  it('emits one synthex.planned with the campaign and organisation ids', async () => {
    const res = await createCampaign(campaignRequest({}));
    await settle();

    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(ofType('synthex.planned')).toHaveLength(1);
    const event = ofType('synthex.planned')[0];
    expect(event).toMatchObject({
      type: 'synthex.planned',
      id: 'camp-1',
      kind: 'campaign',
      organizationId: 'org-1',
      source: 'synthex',
    });
    expect(typeof event.timestamp).toBe('string');
    expect(event).not.toHaveProperty('missionId');
  });

  it('carries missionId when Mission Control started the campaign', async () => {
    await createCampaign(campaignRequest({ missionId: 'mission-42' }));
    await settle();

    expect(ofType('synthex.planned')).toHaveLength(1);
    expect(ofType('synthex.planned')[0].missionId).toBe('mission-42');
  });

  it('a failing connector does not fail the create, and the failure is recorded', async () => {
    fetchMode = 'network_error';

    const res = await createCampaign(campaignRequest({}));
    await settle();

    expect(res.status).toBe(200);
    expect((await res.json()).campaign.id).toBe('camp-1');
    expect(getLastUniteGroupDelivery()).toMatchObject({
      ok: false,
      eventType: 'synthex.planned',
      error: 'connect ECONNREFUSED',
    });
  });
});

// ── planned / drafted / held: Studio draft save ─────────────────────────────

function draftDelegate(): StudioDraftDelegate {
  return {
    create: async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'draft-1',
      ...data,
    }),
    findFirst: async () => ({ id: 'draft-1' }),
    updateMany: async () => ({ count: 0 }),
    findMany: async () => [],
    upsert: async () => ({}),
  } as unknown as StudioDraftDelegate;
}

const DRAFT_INPUT = {
  organizationId: 'org-carsi',
  clientSlug: 'carsi',
  topic: 'Topic',
  script: 'Script',
  platforms: ['linkedin'],
};

describe('drafted + held — Studio draft save', () => {
  it('a new draft emits planned, drafted and held once each, with the draft and organisation ids', async () => {
    const row = await saveStudioDraft(DRAFT_INPUT, draftDelegate());
    await settle();

    expect(row?.id).toBe('draft-1');
    expect(witness().map(event => event.type)).toEqual([
      'synthex.planned',
      'synthex.drafted',
      'synthex.held',
    ]);
    for (const event of witness()) {
      expect(event).toMatchObject({
        id: 'draft-1',
        kind: 'studio_draft',
        organizationId: 'org-carsi',
      });
      expect(event).not.toHaveProperty('missionId');
    }
  });

  it('carries missionId and keeps it on the draft metadata for the approval', async () => {
    let stored: Record<string, unknown> = {};
    const delegate = draftDelegate();
    const create = delegate.create;
    (delegate as { create: unknown }).create = async (args: {
      data: Record<string, unknown>;
    }) => {
      stored = args.data;
      return create(args as never);
    };

    await saveStudioDraft(
      { ...DRAFT_INPUT, missionId: 'mission-7', metadata: { a: 1 } },
      delegate
    );
    await settle();

    expect(witness()).toHaveLength(3);
    for (const event of witness()) expect(event.missionId).toBe('mission-7');
    expect(stored.metadata).toEqual({ a: 1, missionId: 'mission-7' });
  });

  it('a draft that has left awaiting_approval is not re-witnessed', async () => {
    const delegate = draftDelegate();
    (delegate as { create: unknown }).create = async () => {
      throw Object.assign(new Error('unique'), { code: 'P2002' });
    };

    await saveStudioDraft({ ...DRAFT_INPUT, dedupeKey: 'k' }, delegate);
    await settle();

    expect(sent).toHaveLength(0);
  });

  it('a failing connector does not fail the save, and the failure is recorded', async () => {
    fetchMode = 'http_500';

    const row = await saveStudioDraft(DRAFT_INPUT, draftDelegate());
    await settle();

    expect(row?.id).toBe('draft-1');
    expect(getLastUniteGroupDelivery()).toMatchObject({
      ok: false,
      statusCode: 500,
    });
  });
});

// ── drafted + held: autopilot ────────────────────────────────────────────────

describe('drafted + held — autopilot', () => {
  it('a held autopilot post emits drafted and held once each, without missionId', async () => {
    witnessAutopilotPost({
      postId: 'post-9',
      organizationId: 'org-dr',
      status: 'draft',
      platform: 'linkedin',
      business: 'Disaster Recovery',
      text: 'Copy',
      scheduledAt: null,
      mediaUrls: [],
    });
    await settle();

    expect(witness().map(event => event.type)).toEqual([
      'synthex.drafted',
      'synthex.held',
    ]);
    for (const event of witness()) {
      expect(event).toMatchObject({
        id: 'post-9',
        kind: 'post',
        organizationId: 'org-dr',
      });
      expect(event).not.toHaveProperty('missionId');
    }
  });
});

// ── approved: Studio approve-and-schedule ───────────────────────────────────

function approvalDeps(
  metadata: Record<string, unknown>,
  claimed = 1
): Parameters<typeof approveAndScheduleStudioDraft>[1] {
  const tx = {
    $executeRawUnsafe: async () => 0,
    studioContentDraft: {
      updateMany: async () => ({ count: claimed }),
      findFirst: async () => ({
        id: 'd1',
        clientSlug: 'carsi',
        topic: 'T',
        script: 'S',
        // blog is not cron-schedulable: the approval commits with no Post.
        platforms: ['blog'],
        videoUrl: null,
        metadata,
      }),
    },
  } as unknown as Prisma.TransactionClient;
  const runInTransaction = (async (fn: (c: unknown) => Promise<unknown>) =>
    fn(tx)) as unknown as StudioTransactionRunner;
  return {
    runInTransaction,
    recordAttempt: async () => undefined,
    publishGate: async () => ({
      allowed: true,
      calendarMode: 'live',
      autoPublishPaused: false,
    }),
    findScheduledStudioPost: async () => null,
    credentialsReady: async () => true,
  } as Parameters<typeof approveAndScheduleStudioDraft>[1];
}

const APPROVE_INPUT = {
  organizationId: 'org-carsi',
  id: 'd1',
  approvedBy: 'phill',
  client: { clientSlug: 'carsi', funnelUrl: null },
};

describe('approved — Studio approval', () => {
  it('emits one synthex.approved with the draft and organisation ids', async () => {
    const result = await approveAndScheduleStudioDraft(
      APPROVE_INPUT,
      approvalDeps({})
    );
    await settle();

    expect(result.outcome).toBe('approved');
    expect(witness()).toHaveLength(1);
    expect(witness()[0]).toMatchObject({
      type: 'synthex.approved',
      id: 'd1',
      kind: 'studio_draft',
      organizationId: 'org-carsi',
    });
    expect(witness()[0]).not.toHaveProperty('missionId');
  });

  it('carries the missionId stored on the draft', async () => {
    await approveAndScheduleStudioDraft(
      APPROVE_INPUT,
      approvalDeps({ missionId: 'mission-7' })
    );
    await settle();

    expect(ofType('synthex.approved')).toHaveLength(1);
    expect(ofType('synthex.approved')[0].missionId).toBe('mission-7');
  });

  it('emits nothing when nothing was approved', async () => {
    const result = await approveAndScheduleStudioDraft(
      APPROVE_INPUT,
      approvalDeps({}, 0)
    );
    await settle();

    expect(result.outcome).toBe('not_awaiting_approval');
    expect(sent).toHaveLength(0);
  });

  it('a failing connector does not fail the approval, and the failure is recorded', async () => {
    fetchMode = 'network_error';

    const result = await approveAndScheduleStudioDraft(
      APPROVE_INPUT,
      approvalDeps({})
    );
    await settle();

    expect(result).toMatchObject({ approved: true, outcome: 'approved' });
    expect(getLastUniteGroupDelivery()).toMatchObject({
      ok: false,
      eventType: 'synthex.approved',
    });
  });
});
