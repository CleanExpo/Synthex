import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { generateToken } from '../lib/auth/jwt-utils';
import { POST as createApprovalRequest } from '../app/api/approvals/route';
import { PATCH as updateApprovalRequest } from '../app/api/approvals/[id]/route';
import { seedPublishQueue } from '../lib/publish/publishQueue';
import {
  CAMPAIGN_AUTHORITY_MANIFEST_KEY,
  type CampaignEvidenceManifest,
} from '../lib/marketing-agency/campaign-authority-manifest';
import {
  buildCcwEofyAuthorityMetadata,
} from '../lib/marketing-agency/ccw-eofy-authority-manifest';
import {
  CCW_EOFY_CAMPAIGN_NAME,
  CCW_EOFY_CAMPAIGN_SLUG,
} from '../lib/marketing-agency/ccw-eofy-calendar';

const UAT_WEEK_START = new Date('2099-06-01T00:00:00.000Z');
const UAT_WEEK_END = new Date('2099-06-07T00:00:00.000Z');

interface RouteJson {
  success?: boolean;
  message?: string;
  error?: string;
  data?: {
    id: string;
    status: string;
    organizationId: string | null;
    currentStep: number;
    totalSteps: number;
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function makeAuthedJsonRequest(
  url: string,
  token: string,
  body: Record<string, unknown>
) {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
    },
    body: JSON.stringify(body),
  });
}

async function parseRouteJson(response: Response): Promise<RouteJson> {
  const body = (await response.json()) as RouteJson;
  if (!response.ok) {
    throw new Error(
      `Route returned ${response.status}: ${body.error ?? body.message ?? 'unknown error'}`
    );
  }
  return body;
}

function slotManifest(slot: Record<string, unknown>): CampaignEvidenceManifest {
  const manifest = slot[CAMPAIGN_AUTHORITY_MANIFEST_KEY];
  assert(manifest, `Slot ${String(slot.id)} missing campaign authority manifest`);
  return manifest as CampaignEvidenceManifest;
}

async function cleanupUatRows(organizationId: string, approvalId?: string) {
  const calendars = await prisma.contentCalendar.findMany({
    where: {
      organizationId,
      weekStart: UAT_WEEK_START,
    },
    select: { id: true },
  });
  const calendarIds = calendars.map(calendar => calendar.id);

  if (calendarIds.length > 0) {
    await prisma.publishQueueItem.deleteMany({
      where: { calendarId: { in: calendarIds } },
    });
  }

  if (approvalId) {
    await prisma.teamNotification.deleteMany({
      where: {
        relatedContentType: 'approval_request',
        relatedContentId: approvalId,
      },
    });
    await prisma.auditLog.deleteMany({
      where: {
        resource: 'approval_request',
        resourceId: approvalId,
      },
    });
    await prisma.approvalRequest.deleteMany({
      where: { id: approvalId },
    });
  }

  await prisma.approvalRequest.deleteMany({
    where: {
      organizationId,
      title: { contains: 'CCW approval publish gate UAT' },
    },
  });

  if (calendarIds.length > 0) {
    await prisma.contentCalendar.deleteMany({
      where: { id: { in: calendarIds } },
    });
  }
}

async function main() {
  const org = await prisma.organization.findUnique({
    where: { slug: 'ccw' },
    select: { id: true, name: true, slug: true },
  });
  assert(org, 'CCW organization not found');

  let approvalId: string | undefined;

  try {
    await cleanupUatRows(org.id);

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { activeOrganizationId: org.id },
          { organizationId: org.id },
          {
            ownedBusinesses: {
              some: { organizationId: org.id, isActive: true },
            },
          },
          {
            teamMemberships: {
              some: { organizationId: org.id },
            },
          },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        isMultiBusinessOwner: true,
        activeOrganizationId: true,
        organizationId: true,
      },
    });
    const user =
      users.find(candidate => candidate.activeOrganizationId === org.id) ??
      users.find(candidate => candidate.organizationId === org.id) ??
      users[0];
    assert(user, 'No existing user has access to the CCW organization');

    const campaign = await prisma.campaign.findFirst({
      where: {
        organizationId: org.id,
        name: CCW_EOFY_CAMPAIGN_NAME,
      },
      select: { id: true, status: true },
    });
    assert(campaign, 'CCW EOFY campaign not found');

    const token = generateToken(
      {
        userId: user.id,
        email: user.email,
        name: user.name ?? undefined,
      },
      '15m'
    );

    const approvedSlotId = 'ccw-uat-approved-slot';
    const blockedSlotId = 'ccw-uat-blocked-slot';
    const calendar = await prisma.contentCalendar.create({
      data: {
        organizationId: org.id,
        weekStart: UAT_WEEK_START,
        weekEnd: UAT_WEEK_END,
        status: 'draft',
        signalsVersion: 'uat-ccw-approval-publish-gate',
        slots: {
          weekStart: '2099-06-01',
          weekEnd: '2099-06-07',
          signalsVersion: 'uat-ccw-approval-publish-gate',
          digestCount: 5,
          slots: [
            {
              id: approvedSlotId,
              dayOfWeek: 0,
              scheduledAt: '2099-06-01T09:00:00.000Z',
              platform: 'instagram',
              captions: ['CCW EOFY UAT approved slot'],
              hashtags: ['#CCW', '#EOFY'],
              contentType: 'promotional',
              status: 'draft',
              ...buildCcwEofyAuthorityMetadata({
                campaignId: campaign.id,
                humanApproved: false,
                platforms: ['instagram'],
              }),
            },
            {
              id: blockedSlotId,
              dayOfWeek: 1,
              scheduledAt: '2099-06-02T09:00:00.000Z',
              platform: 'linkedin',
              captions: ['CCW EOFY UAT blocked slot'],
              hashtags: ['#CCW', '#EOFY'],
              contentType: 'promotional',
              status: 'approved',
              ...buildCcwEofyAuthorityMetadata({
                campaignId: campaign.id,
                humanApproved: false,
                platforms: ['linkedin'],
              }),
            },
          ],
        },
      },
      select: { id: true },
    });

    const createResponse = await createApprovalRequest(
      makeAuthedJsonRequest('http://localhost/api/approvals', token, {
        contentId: calendar.id,
        contentType: 'content_calendar_slot',
        title: `CCW approval publish gate UAT ${calendar.id}`,
        description:
          'Temporary founder UAT request for CCW campaign authority approval gate.',
        priority: 'high',
        metadata: {
          campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
          calendarId: calendar.id,
          slotId: approvedSlotId,
          platforms: ['instagram'],
          uat: true,
        },
      })
    );
    const created = await parseRouteJson(createResponse);
    approvalId = created.data?.id;

    assert(approvalId, 'Approval request was not created');
    assert(
      created.data?.organizationId === org.id,
      `Approval scoped to ${created.data?.organizationId ?? 'null'}, expected CCW ${org.id}`
    );

    let latest = created.data;
    for (let i = 0; i < 3 && latest?.status !== 'approved'; i++) {
      const approveResponse = await updateApprovalRequest(
        makeAuthedJsonRequest(
          `http://localhost/api/approvals/${approvalId}`,
          token,
          {
            action: 'approve',
            comment: `Founder UAT approval step ${i + 1}`,
          }
        ),
        { params: Promise.resolve({ id: approvalId }) }
      );
      const approved = await parseRouteJson(approveResponse);
      latest = approved.data;
    }

    assert(latest?.status === 'approved', 'Approval request did not reach approved');

    const stampedCalendar = await prisma.contentCalendar.findUnique({
      where: { id: calendar.id },
      select: { slots: true },
    });
    const calendarData = stampedCalendar?.slots as {
      slots?: Record<string, unknown>[];
    } | null;
    const slots = calendarData?.slots ?? [];
    const approvedSlot = slots.find(slot => slot.id === approvedSlotId);
    const blockedSlot = slots.find(slot => slot.id === blockedSlotId);
    assert(approvedSlot, 'Approved UAT slot not found after approval');
    assert(blockedSlot, 'Blocked UAT slot not found after approval');

    const approvedManifest = slotManifest(approvedSlot);
    const blockedManifest = slotManifest(blockedSlot);
    assert(
      approvedSlot.status === 'approved',
      'Approved UAT slot status was not stamped approved'
    );
    assert(
      approvedManifest.approval.status === 'approved' &&
        approvedManifest.approval.humanApproved === true,
      'Approved UAT slot manifest was not stamped human-approved'
    );
    assert(
      blockedManifest.approval.status !== 'approved' &&
        blockedManifest.approval.humanApproved !== true,
      'Blocked UAT slot was unexpectedly approved'
    );

    const seeded = await seedPublishQueue(calendar.id, org.id);
    const seededAgain = await seedPublishQueue(calendar.id, org.id);
    const queueRows = await prisma.publishQueueItem.findMany({
      where: { calendarId: calendar.id },
      select: { slotId: true, platform: true, status: true },
      orderBy: { slotId: 'asc' },
    });

    assert(seeded === 1, `Expected one queue row seeded, got ${seeded}`);
    assert(seededAgain === 0, `Expected idempotent reseed to create 0, got ${seededAgain}`);
    assert(queueRows.length === 1, `Expected one queue row, got ${queueRows.length}`);
    assert(
      queueRows[0]?.slotId === approvedSlotId &&
        queueRows[0]?.platform === 'instagram' &&
        queueRows[0]?.status === 'pending',
      'Publish queue did not contain only the approved manifest slot'
    );

    console.log(
      JSON.stringify(
        {
          success: true,
          org: org.slug,
          campaignStatus: campaign.status,
          approvalStatus: latest.status,
          approvedSlotManifestStatus: approvedManifest.approval.status,
          blockedSlotManifestStatus: blockedManifest.approval.status,
          seeded,
          seededAgain,
          queueRows,
          cleanup: 'pending',
        },
        null,
        2
      )
    );
  } finally {
    await cleanupUatRows(org.id, approvalId);
    await prisma.$disconnect();
  }
}

main().catch(async error => {
  await prisma.$disconnect();
  console.error(error);
  process.exit(1);
});
