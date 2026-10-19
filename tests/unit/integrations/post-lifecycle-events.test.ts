/**
 * Post lifecycle events for the Mission Control calendar (DECISIONS FD-11).
 *
 * Every post sends post.drafted, post.awaiting_approval, post.approved,
 * post.scheduled, post.published and post.failed through the existing
 * Unite-Group connector, once, at the code point where that state is reached
 * and after it succeeded. Each carries the full field set; text is capped at
 * 5,000 chars; missionId rides only when known; approveUrl is an absolute link
 * naming that post. A failing connector never fails the post action.
 *
 * The connector is real; only `fetch` is replaced, so these tests see the
 * exact bodies Unite-Group would receive.
 */

import type { Prisma } from '@prisma/client';
import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { buildApprovedCampaignAuthorityManifest } from '@/tests/helpers/campaign-authority-manifest';

// ── Plain-function mocks (jest config resets jest.fn implementations) ───────

type Sent = Record<string, unknown>;
let sent: Sent[] = [];
let fetchFails = false;
async function fakeFetch(_url: string, init: { body: string }) {
  if (fetchFails) throw new Error('connect ECONNREFUSED');
  sent.push(JSON.parse(init.body) as Sent);
  return { status: 200 } as Response;
}

let duePosts: unknown[] = [];
let connection: unknown = null;
let postUpdates: Array<{ data: Record<string, unknown> }> = [];
jest.mock('@/lib/prisma', () => {
  const client = {
    post: {
      findMany: async () => duePosts,
      findUnique: async () => ({ metadata: {} }),
      update: async (args: { data: Record<string, unknown> }) => {
        postUpdates.push(args);
        return {};
      },
      updateMany: async () => ({ count: 1 }),
    },
    platformConnection: { findFirst: async () => connection },
    notification: { create: async () => ({}) },
    platformPost: { create: async () => ({}) },
    organization: { findUnique: async () => ({ slug: 'carsi' }) },
    studioContentDraft: {},
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: () => ({ ok: true }),
}));
jest.mock('@/lib/social', () => ({
  isPlatformSupported: (platform: string) => platform === 'linkedin',
  createPlatformService: () => ({
    createPost: async () => ({
      success: true,
      postId: 'li-1',
      url: 'https://www.linkedin.com/feed/update/li-1',
    }),
  }),
}));
jest.mock('@/lib/security/field-encryption', () => ({
  decryptFieldSafe: (value: string) => value,
}));
jest.mock('@/lib/publish/safetyChecks', () => ({
  resolveOrgAutoPublishGate: async () => ({ allowed: true }),
}));
jest.mock('@/lib/cache/invalidate-stats', () => ({
  invalidatePostStats: async () => undefined,
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

import { GET as publishScheduled } from '@/app/api/cron/publish-scheduled/route';
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
  fetchFails = false;
  duePosts = [];
  connection = null;
  postUpdates = [];
  process.env.UNITE_GROUP_EVENTS_URL = 'https://unite.example';
  process.env.UNITE_GROUP_EVENTS_API_KEY = 'test-key';
  process.env.NEXT_PUBLIC_APP_URL = 'https://synthex.example/';
  global.fetch = fakeFetch as unknown as typeof fetch;
  console.error = () => undefined;
});

afterAll(() => {
  global.fetch = realFetch;
  console.error = realConsoleError;
  delete process.env.UNITE_GROUP_EVENTS_URL;
  delete process.env.UNITE_GROUP_EVENTS_API_KEY;
  delete process.env.NEXT_PUBLIC_APP_URL;
});

const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const postEvents = () =>
  sent.filter(event => String(event.type).startsWith('post.'));
const ofType = (type: string) => sent.filter(event => event.type === type);

const FIELDS = [
  'postId',
  'platform',
  'business',
  'scheduledAt',
  'publishedAt',
  'text',
  'mediaThumbnailUrls',
  'postUrl',
  'approveUrl',
];

/** One event of `type`, carrying every field, with an absolute approveUrl. */
function only(type: string): Sent {
  const events = ofType(type);
  expect(events).toHaveLength(1);
  const event = events[0];
  for (const field of FIELDS) expect(event).toHaveProperty(field);
  expect(Array.isArray(event.mediaThumbnailUrls)).toBe(true);
  expect(new URL(String(event.approveUrl)).origin).toBe(
    'https://synthex.example'
  );
  return event;
}

// ── drafted + awaiting_approval: Studio draft save ──────────────────────────

function draftDelegate(): StudioDraftDelegate {
  return {
    create: async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'draft-1',
      ...data,
    }),
    findFirst: async () => ({ id: 'draft-1' }),
    updateMany: async () => ({ count: 0 }),
  } as unknown as StudioDraftDelegate;
}

const DRAFT_INPUT = {
  organizationId: 'org-carsi',
  clientSlug: 'carsi',
  topic: 'Topic',
  script: 'Mould after a flood: what to check first.',
  platforms: ['linkedin', 'instagram'],
  videoUrl: 'https://cdn.example/v.mp4',
};

describe('Studio draft save', () => {
  it('emits post.drafted and post.awaiting_approval once each with the full field set', async () => {
    const row = await saveStudioDraft(DRAFT_INPUT, draftDelegate());
    await settle();

    expect(row?.id).toBe('draft-1');
    expect(postEvents().map(event => event.type)).toEqual([
      'post.drafted',
      'post.awaiting_approval',
    ]);
    for (const type of ['post.drafted', 'post.awaiting_approval']) {
      const event = only(type);
      expect(event).toMatchObject({
        postId: 'draft-1',
        platform: 'linkedin,instagram',
        business: 'carsi',
        scheduledAt: null,
        publishedAt: null,
        text: DRAFT_INPUT.script,
        mediaThumbnailUrls: ['https://cdn.example/v.mp4'],
        postUrl: null,
        approveUrl:
          'https://synthex.example/dashboard/marketing-agency/carsi/studio?draft=draft-1',
      });
      expect(event).not.toHaveProperty('missionId');
      expect(event).not.toHaveProperty('error');
    }
  });

  it('carries missionId when Mission Control started the job', async () => {
    await saveStudioDraft(
      { ...DRAFT_INPUT, missionId: 'mission-7' },
      draftDelegate()
    );
    await settle();

    expect(postEvents()).toHaveLength(2);
    for (const event of postEvents()) expect(event.missionId).toBe('mission-7');
  });

  it('caps the text at 5,000 chars', async () => {
    await saveStudioDraft(
      { ...DRAFT_INPUT, script: 'x'.repeat(6000) },
      draftDelegate()
    );
    await settle();

    expect(String(only('post.drafted').text)).toHaveLength(5000);
  });

  it('a failing connector does not fail the save', async () => {
    fetchFails = true;
    const row = await saveStudioDraft(DRAFT_INPUT, draftDelegate());
    await settle();

    expect(row?.id).toBe('draft-1');
    expect(getLastUniteGroupDelivery()).toMatchObject({ ok: false });
  });
});

// ── drafted + awaiting_approval / scheduled: autopilot ──────────────────────

const AUTOPILOT_POST = {
  postId: 'post-9',
  organizationId: 'org-dr',
  platform: 'linkedin',
  business: 'Disaster Recovery',
  text: 'Storm season checklist.',
  scheduledAt: null,
  mediaUrls: [],
};

describe('autopilot post write', () => {
  it('a held post emits post.drafted and post.awaiting_approval once each, without missionId', async () => {
    witnessAutopilotPost({ ...AUTOPILOT_POST, status: 'draft' });
    await settle();

    expect(postEvents().map(event => event.type)).toEqual([
      'post.drafted',
      'post.awaiting_approval',
    ]);
    const event = only('post.awaiting_approval');
    expect(event).toMatchObject({
      postId: 'post-9',
      platform: 'linkedin',
      business: 'Disaster Recovery',
      text: 'Storm season checklist.',
      mediaThumbnailUrls: [],
      approveUrl: 'https://synthex.example/dashboard/calendar?post=post-9',
    });
    expect(event).not.toHaveProperty('missionId');
  });

  it('a post the gate scheduled emits post.scheduled instead of awaiting_approval', async () => {
    witnessAutopilotPost({
      ...AUTOPILOT_POST,
      status: 'scheduled',
      scheduledAt: new Date('2026-10-20T09:00:00.000Z'),
      mediaUrls: ['https://cdn.example/a.jpg'],
    });
    await settle();

    expect(postEvents().map(event => event.type)).toEqual([
      'post.drafted',
      'post.scheduled',
    ]);
    expect(only('post.scheduled')).toMatchObject({
      scheduledAt: '2026-10-20T09:00:00.000Z',
      mediaThumbnailUrls: ['https://cdn.example/a.jpg'],
    });
  });
});

// ── approved + scheduled: Studio approve-and-schedule ───────────────────────

let scheduledInputs: Array<{ metadata?: Record<string, unknown> }> = [];
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
        script: 'Approved script.',
        platforms: ['linkedin'],
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
    isSchedulable: () => true,
    findScheduledStudioPost: async () => null,
    credentialsReady: async () => true,
    schedule: async (input: { metadata?: Record<string, unknown> }) => {
      scheduledInputs.push(input);
      return {
        id: 'post-1',
        platform: 'linkedin',
        scheduledAt: '2026-10-20T09:00:00.000Z',
        status: 'scheduled' as const,
      };
    },
  } as Parameters<typeof approveAndScheduleStudioDraft>[1];
}

const APPROVE_INPUT = {
  organizationId: 'org-carsi',
  id: 'd1',
  approvedBy: 'phill',
  client: { clientSlug: 'carsi', funnelUrl: null },
};

describe('Studio approval', () => {
  beforeEach(() => {
    scheduledInputs = [];
  });

  it('emits post.approved for the draft and post.scheduled for its Post, once each', async () => {
    const result = await approveAndScheduleStudioDraft(
      APPROVE_INPUT,
      approvalDeps({})
    );
    await settle();

    expect(result.outcome).toBe('approved');
    expect(postEvents().map(event => event.type)).toEqual([
      'post.approved',
      'post.scheduled',
    ]);
    expect(only('post.approved')).toMatchObject({
      postId: 'd1',
      platform: 'linkedin',
      business: 'carsi',
      scheduledAt: '2026-10-20T09:00:00.000Z',
      text: 'Approved script.',
      approveUrl:
        'https://synthex.example/dashboard/marketing-agency/carsi/studio?draft=d1',
    });
    const scheduled = only('post.scheduled');
    expect(scheduled).toMatchObject({
      postId: 'post-1',
      studioDraftId: 'd1',
      platform: 'linkedin',
      scheduledAt: '2026-10-20T09:00:00.000Z',
      publishedAt: null,
      postUrl: null,
      approveUrl: 'https://synthex.example/dashboard/calendar?post=post-1',
    });
    expect(scheduled).not.toHaveProperty('missionId');
  });

  it('carries the draft missionId and threads it onto the scheduled Post', async () => {
    await approveAndScheduleStudioDraft(
      APPROVE_INPUT,
      approvalDeps({ missionId: 'mission-7' })
    );
    await settle();

    expect(only('post.approved').missionId).toBe('mission-7');
    expect(only('post.scheduled').missionId).toBe('mission-7');
    expect(scheduledInputs[0].metadata?.missionId).toBe('mission-7');
  });

  it('emits nothing when nothing was approved', async () => {
    await approveAndScheduleStudioDraft(APPROVE_INPUT, approvalDeps({}, 0));
    await settle();

    expect(postEvents()).toHaveLength(0);
  });

  it('a failing connector does not fail the approval', async () => {
    fetchFails = true;
    const result = await approveAndScheduleStudioDraft(
      APPROVE_INPUT,
      approvalDeps({})
    );
    await settle();

    expect(result).toMatchObject({ approved: true, outcome: 'approved' });
  });
});

// ── awaiting_approval / published / failed: publish-scheduled cron ──────────

function duePost(metadata: Record<string, unknown>, content = 'Live copy.') {
  return {
    id: 'post-1',
    content,
    platform: 'linkedin',
    metadata,
    scheduledAt: new Date('2026-10-20T09:00:00.000Z'),
    campaign: {
      userId: 'u1',
      platform: 'linkedin',
      organizationId: 'org-carsi',
      settings: {},
      content: {},
    },
  };
}

const approvedManifest = () =>
  buildApprovedCampaignAuthorityManifest({
    platformOutputs: [
      { platform: 'linkedin', status: 'approved', contentRef: 'post-1' },
    ],
  });

const LIVE_CONNECTION = {
  id: 'conn-1',
  accessToken: 'tok',
  refreshToken: null,
  expiresAt: null,
  profileId: 'p',
  profileName: 'n',
};

const cronRequest = () =>
  createMockNextRequest({
    url: 'http://localhost/api/cron/publish-scheduled',
  });

describe('publish-scheduled cron', () => {
  it('a published post emits post.published once with its live URL', async () => {
    duePosts = [
      duePost({
        campaignAuthorityManifest: approvedManifest(),
        images: ['https://cdn.example/a.jpg'],
        missionId: 'mission-7',
        studioDraftId: 'd1',
      }),
    ];
    connection = LIVE_CONNECTION;

    const body = await (await publishScheduled(cronRequest())).json();

    expect(body.published).toBe(1);
    expect(postEvents().map(event => event.type)).toEqual(['post.published']);
    const event = only('post.published');
    expect(event).toMatchObject({
      postId: 'post-1',
      missionId: 'mission-7',
      studioDraftId: 'd1',
      platform: 'linkedin',
      business: 'carsi',
      scheduledAt: '2026-10-20T09:00:00.000Z',
      text: 'Live copy.',
      mediaThumbnailUrls: ['https://cdn.example/a.jpg'],
      postUrl: 'https://www.linkedin.com/feed/update/li-1',
      approveUrl: 'https://synthex.example/dashboard/calendar?post=post-1',
    });
    expect(typeof event.publishedAt).toBe('string');
    // The existing content.published event is unchanged.
    expect(ofType('content.published')).toHaveLength(1);
  });

  it('a permanently failed post emits post.failed once with a short error and no missionId', async () => {
    duePosts = [duePost({ campaignAuthorityManifest: approvedManifest() })];
    connection = null;

    const body = await (await publishScheduled(cronRequest())).json();

    expect(body.failed).toBe(1);
    expect(postEvents().map(event => event.type)).toEqual(['post.failed']);
    const event = only('post.failed');
    expect(event).toMatchObject({
      postId: 'post-1',
      publishedAt: null,
      postUrl: null,
      error: 'No connected linkedin account for organization org-carsi',
    });
    expect(event).not.toHaveProperty('missionId');
  });

  it('a post the authority gate holds emits post.awaiting_approval once', async () => {
    duePosts = [
      duePost({
        campaignAuthorityManifest: buildApprovedCampaignAuthorityManifest({
          platformOutputs: [
            { platform: 'linkedin', status: 'approved', contentRef: 'post-1' },
          ],
          approval: { status: 'pending', humanApproved: false },
        }),
      }),
    ];

    const body = await (await publishScheduled(cronRequest())).json();

    expect(body.blocked).toBe(1);
    expect(postEvents().map(event => event.type)).toEqual([
      'post.awaiting_approval',
    ]);
    only('post.awaiting_approval');
  });

  it('caps a long post text at 5,000 chars', async () => {
    duePosts = [
      duePost(
        { campaignAuthorityManifest: approvedManifest() },
        'y'.repeat(7000)
      ),
    ];
    connection = LIVE_CONNECTION;

    await publishScheduled(cronRequest());

    expect(String(only('post.published').text)).toHaveLength(5000);
  });

  it('a failing connector does not fail the publish', async () => {
    fetchFails = true;
    duePosts = [duePost({ campaignAuthorityManifest: approvedManifest() })];
    connection = LIVE_CONNECTION;

    const res = await publishScheduled(cronRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.published).toBe(1);
    expect(postUpdates.some(update => update.data.status === 'published')).toBe(
      true
    );
    expect(getLastUniteGroupDelivery()).toMatchObject({ ok: false });
  });
});
