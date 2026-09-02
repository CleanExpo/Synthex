/**
 * The Studio approval transaction, executed against a real Postgres.
 *
 * The unit suite proves the bridge's logic with an in-memory row and injected
 * dependencies; nothing there executes the statements the bench asked to see
 * run: `SET LOCAL statement_timeout` / `lock_timeout` inside the interactive
 * transaction, the claim's row-scoped UPDATE, the Post creation through the
 * transaction client, and `defaultRecordAttempt`'s hand-written jsonb merge
 * (`metadata = COALESCE(metadata,'{}'::jsonb) || $1::jsonb` on the row that is
 * still `awaiting_approval`). This test runs them with NO injected runner and
 * NO injected attempt record, against the sandbox (:5499, guard-enforced).
 *
 * Two cases:
 *   1. an approval commits: the draft is `approved`, a Post row exists carrying
 *      the draft id, and `studioSchedule` is recorded;
 *   2. an organisation in shadow mode blocks: the transaction rolls back, the
 *      draft is still `awaiting_approval`, a sibling metadata key survives, and
 *      ONLY `studioScheduleAttempt` was merged in.
 *
 * The negative control for the merge is the unit test that asserts the SQL's
 * text; this test is the one that proves the text is valid against the schema.
 *
 * Run: npm run test:integration
 */

import { assertSandboxDatabaseUrl } from './setup/sandbox-guard';
import { createSandboxPrismaClient } from './setup/seed';
import { approveAndScheduleStudioDraft } from '@/lib/marketing-agency/studio/approve-and-schedule';

const ORG = 'itest-studio-org';
const USER = 'itest-studio-user';
const DRAFT = 'itest-studio-draft';
const CONNECTION = 'itest-studio-linkedin';

describe('Studio approval transaction (real Postgres)', () => {
  assertSandboxDatabaseUrl(process.env.DATABASE_URL);
  const { prisma, pool } = createSandboxPrismaClient();

  const resetDraft = async (metadata: Record<string, unknown>) =>
    prisma.studioContentDraft.upsert({
      where: { id: DRAFT },
      update: {
        status: 'awaiting_approval',
        approvedBy: null,
        approvedAt: null,
        metadata,
        platforms: ['linkedin'],
      },
      create: {
        id: DRAFT,
        organizationId: ORG,
        clientSlug: 'itest-studio',
        topic: 'Integration: the approval transaction',
        script: 'Body of the post.',
        platforms: ['linkedin'],
        metadata,
      },
    });

  beforeAll(async () => {
    await prisma.organization.upsert({
      where: { id: ORG },
      update: { calendarMode: 'live', autoPublishPaused: false },
      create: {
        id: ORG,
        name: 'Integration Studio Org',
        slug: 'itest-studio',
        plan: 'free',
        status: 'active',
        calendarMode: 'live',
        autoPublishPaused: false,
        website: 'https://itest-studio.example',
      },
    });
    await prisma.user.upsert({
      where: { id: USER },
      update: { organizationId: ORG },
      create: {
        id: USER,
        email: 'itest-studio-user@synthex.test',
        name: 'Integration Studio User',
        organizationId: ORG,
      },
    });
    await prisma.platformConnection.upsert({
      where: { id: CONNECTION },
      update: { isActive: true, organizationId: ORG },
      create: {
        id: CONNECTION,
        userId: USER,
        platform: 'linkedin',
        accessToken: 'itest-not-a-real-token',
        isActive: true,
        organizationId: ORG,
      },
    });
  });

  afterAll(async () => {
    await prisma.post.deleteMany({
      where: { metadata: { path: ['studioDraftId'], equals: DRAFT } },
    });
    await prisma.campaign.deleteMany({
      where: { userId: USER, name: 'Scheduled Posts' },
    });
    await prisma.studioContentDraft.deleteMany({ where: { id: DRAFT } });
    await prisma.platformConnection.deleteMany({ where: { id: CONNECTION } });
    await prisma.$disconnect();
    await pool.end();
  });

  const input = {
    organizationId: ORG,
    id: DRAFT,
    approvedBy: USER,
    client: {
      clientSlug: 'itest-studio',
      funnelUrl: 'https://itest-studio.example/go',
    },
  };

  it('commits the claim, the Post and the record together', async () => {
    await resetDraft({
      externalPublishingAllowed: false,
      externalPublishBlocks: {
        linkedin: [
          'platform_credentials_required',
          'human_or_client_approval_required',
        ],
      },
    });
    await prisma.post.deleteMany({
      where: { metadata: { path: ['studioDraftId'], equals: DRAFT } },
    });

    const result = await approveAndScheduleStudioDraft(input);

    expect(result.outcome).toBe('approved');
    expect(result.scheduled).toHaveLength(1);

    const draft = await prisma.studioContentDraft.findUnique({
      where: { id: DRAFT },
    });
    expect(draft?.status).toBe('approved');
    expect(draft?.approvedBy).toBe(USER);
    const metadata = draft?.metadata as Record<string, unknown>;
    expect(metadata.externalPublishingAllowed).toBe(true);
    expect(metadata.studioSchedule).toMatchObject({
      scheduled: [{ platform: 'linkedin', postId: result.scheduled[0].postId }],
    });

    const posts = await prisma.post.findMany({
      where: { metadata: { path: ['studioDraftId'], equals: DRAFT } },
    });
    expect(posts).toHaveLength(1);
    expect(posts[0].status).toBe('scheduled');
    expect(posts[0].id).toBe(result.scheduled[0].postId);
  });

  it('rolls back a blocked approval and merges only studioScheduleAttempt into the still-awaiting row', async () => {
    await resetDraft({
      ownedMediaGate: { allowed: true },
      externalPublishingAllowed: false,
      externalPublishBlocks: {
        linkedin: ['final_asset_rights_check_required'],
      },
      siblingKey: 'must survive',
    });
    await prisma.post.deleteMany({
      where: { metadata: { path: ['studioDraftId'], equals: DRAFT } },
    });
    await prisma.organization.update({
      where: { id: ORG },
      data: { calendarMode: 'shadow' },
    });

    const result = await approveAndScheduleStudioDraft(input);

    expect(result.outcome).toBe('blocked');
    expect(result.skipped).toEqual([
      {
        platform: 'linkedin',
        reason: 'org_publish_gate: calendar_mode_shadow',
      },
    ]);

    const draft = await prisma.studioContentDraft.findUnique({
      where: { id: DRAFT },
    });
    expect(draft?.status).toBe('awaiting_approval');
    expect(draft?.approvedBy).toBeNull();
    const metadata = draft?.metadata as Record<string, unknown>;
    expect(metadata.siblingKey).toBe('must survive');
    expect(metadata.ownedMediaGate).toEqual({ allowed: true });
    expect(metadata.externalPublishClearances).toBeUndefined();
    expect(metadata.studioScheduleAttempt).toMatchObject({
      outcome: 'blocked',
      attemptedBy: USER,
      skipped: result.skipped,
    });

    const posts = await prisma.post.findMany({
      where: { metadata: { path: ['studioDraftId'], equals: DRAFT } },
    });
    expect(posts).toHaveLength(0);

    await prisma.organization.update({
      where: { id: ORG },
      data: { calendarMode: 'live' },
    });
  });
});
