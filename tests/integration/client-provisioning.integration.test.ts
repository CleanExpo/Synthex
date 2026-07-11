/**
 * Track B — client provisioning E2E against the SYN-MCP-000 Docker sandbox
 * (real Postgres :5499; prod structurally unreachable via sandbox-guard).
 *
 * Spec: docs/specs/spm-track-b-client-provisioning.md §13/§14 — the
 * INTEGRATION claim class:
 *   - concurrent provision race: exactly one child (the slug @unique index
 *     arbitrates — criterion 1)
 *   - replay burst: one child, N-1 replay_detected audits (§14b, criterion 9)
 *   - end-to-end suspension cut-off, EACH plane asserted separately
 *     (criterion 5): MCP keys, MCP org-status gate, withAuth, home pointers,
 *     evidence flip, getEffectiveOrganizationId, mint refusal
 *   - TeamInvitation evidence round-trip (criteria 6 & 13)
 *   - cross-tenant adversarial read: sibling brands never see each other's
 *     children; a child-org caller cannot provision (criterion 12)
 *   - brand-slug rename does NOT move idempotency; tombstoned replay 409s
 *     (criterion 17)
 *   - 50-child fan-out under one brand (§14a)
 *
 * Real modules throughout. The ONLY substitutions: '@/lib/prisma' → sandbox
 * client (house convention — lib/prisma.ts is Supabase-tuned and rejects the
 * sandbox), jwt identity (withAuth routes need a session; everything after
 * identity resolution runs real), and the Resend email transport (env-gated
 * OFF in these tests anyway).
 */
jest.mock('@/lib/prisma', () => {
  const { createSandboxPrismaClient } = require('./setup/seed');
  const { prisma } = createSandboxPrismaClient();
  return { __esModule: true, default: prisma, prisma };
});

const mockGetUserId = jest.fn<Promise<string | null>, unknown[]>();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

jest.mock('@/lib/email/team-invite-email', () => ({
  sendBrandedTeamInviteEmail: jest.fn(async () => ({ success: true })),
}));

import prisma from '@/lib/prisma';
import {
  provisionClientOrg,
  deriveClientSlug,
} from '@/lib/tenancy/provision-client-org';
import {
  POST as clientsPost,
  GET as clientsGet,
} from '@/app/api/command-centre/clients/route';
import { POST as offboardPost } from '@/app/api/command-centre/clients/[id]/offboard/route';
import { resolveOrgFromBearer, hashMcpKey } from '@/app/api/mcp/auth';
import { POST as mintPost } from '@/app/api/admin/mcp-keys/route';
import {
  hasInviteEvidence,
  hasSelfProvisionEvidence,
} from '@/lib/auth/invite-gate';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { withAuth } from '@/lib/auth/with-auth';
import { assertSandboxDatabaseUrl } from './setup/sandbox-guard';

const ADMIN_KEY = 'itest-tb-admin-key';
const P = 'itest-tb'; // fixture prefix — everything cleaned up by afterAll

const BRAND_A = `${P}-brand-a`;
const BRAND_B = `${P}-brand-b`;
const ADMIN_A = `${P}-admin-a`;
const ADMIN_B = `${P}-admin-b`;

function jsonRequest(url: string, body?: object): any {
  return {
    url,
    method: body ? 'POST' : 'GET',
    headers: { get: () => null },
    cookies: { get: () => undefined },
    nextUrl: new URL(url),
    json: async () => body ?? {},
  };
}

function adminMintRequest(body: unknown): any {
  return {
    url: 'http://localhost/api/admin/mcp-keys',
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'x-admin-api-key' ? ADMIN_KEY : null,
    },
    cookies: { get: () => undefined },
    json: async () => body,
  };
}

async function cleanup() {
  const brandIds = [BRAND_A, BRAND_B];
  const children = await prisma.organization.findMany({
    where: { parentOrgId: { in: brandIds } },
    select: { id: true },
  });
  const childIds = children.map(c => c.id);
  const allOrgIds = [...childIds, ...brandIds];
  await prisma.mcpApiKey.deleteMany({
    where: { organizationId: { in: allOrgIds } },
  });
  await prisma.orgBudgetPolicy.deleteMany({
    where: { organizationId: { in: allOrgIds } },
  });
  await prisma.teamInvitation.deleteMany({
    where: { organizationId: { in: allOrgIds } },
  });
  await prisma.userRole.deleteMany({
    where: { role: { organizationId: { in: allOrgIds } } },
  });
  await prisma.role.deleteMany({
    where: { organizationId: { in: allOrgIds } },
  });
  await prisma.teamMember.deleteMany({
    where: { organizationId: { in: allOrgIds } },
  });
  await prisma.user.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.auditLog.deleteMany({
    where: { action: { startsWith: 'provisioning.' } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: childIds } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: brandIds } },
  });
}

describe('Track B client provisioning — sandbox E2E', () => {
  assertSandboxDatabaseUrl(process.env.DATABASE_URL);

  beforeAll(async () => {
    process.env.ADMIN_API_KEY = ADMIN_KEY;
    delete process.env.SYNTHEX_PROVISIONING_INVITE_EMAILS;
    await cleanup();
    // Two sibling brands with one owner-admin each.
    for (const [orgId, userId, slug] of [
      [BRAND_A, ADMIN_A, `${P}-brand-a`],
      [BRAND_B, ADMIN_B, `${P}-brand-b`],
    ] as const) {
      await prisma.organization.create({
        data: {
          id: orgId,
          name: `Track B Brand ${orgId}`,
          slug,
          plan: 'pro',
          status: 'active',
        },
      });
      await prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@synthex.test`,
          name: userId,
          organizationId: orgId,
        },
      });
    }
  }, 60_000);

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  }, 60_000);

  beforeEach(() => {
    mockGetUserId.mockResolvedValue(ADMIN_A);
  });

  // =========================================================================
  // Criterion 1 — DB-arbitrated idempotency
  // =========================================================================
  it('concurrent provision race: the slug unique index arbitrates — exactly one child', async () => {
    const input = {
      parentOrgId: BRAND_A,
      externalRef: 'RACE-1',
      clientName: 'Race Client',
      ownerEmail: `${P}-race-owner@synthex.test`,
      provisionedBy: ADMIN_A,
    };

    const results = await Promise.all([
      provisionClientOrg(input),
      provisionClientOrg(input),
    ]);

    const slug = deriveClientSlug(BRAND_A, 'RACE-1');
    const rows = await prisma.organization.findMany({ where: { slug } });
    expect(rows).toHaveLength(1);
    expect(results.filter(r => !r.replayed)).toHaveLength(1);
    expect(new Set(results.map(r => r.organization.id)).size).toBe(1);
  });

  it('replay burst: 20x the same externalRef -> one child, 19 replay_detected audits (criterion 9)', async () => {
    const input = {
      parentOrgId: BRAND_A,
      externalRef: 'BURST-1',
      clientName: 'Burst Client',
      ownerEmail: `${P}-burst-owner@synthex.test`,
      provisionedBy: ADMIN_A,
    };
    for (let i = 0; i < 20; i++) {
      await provisionClientOrg(input);
    }

    const slug = deriveClientSlug(BRAND_A, 'BURST-1');
    const rows = await prisma.organization.findMany({ where: { slug } });
    expect(rows).toHaveLength(1);

    const replays = await prisma.auditLog.count({
      where: {
        action: 'provisioning.replay_detected',
        details: { path: ['externalRef'], equals: 'BURST-1' },
      },
    });
    expect(replays).toBe(19);
    const created = await prisma.auditLog.count({
      where: {
        action: 'provisioning.created',
        details: { path: ['externalRef'], equals: 'BURST-1' },
      },
    });
    expect(created).toBe(1);
  });

  it('brand-slug rename does NOT move idempotency (criterion 17)', async () => {
    const input = {
      parentOrgId: BRAND_A,
      externalRef: 'RENAME-1',
      clientName: 'Rename Client',
      ownerEmail: `${P}-rename-owner@synthex.test`,
      provisionedBy: ADMIN_A,
    };
    const first = await provisionClientOrg(input);

    await prisma.organization.update({
      where: { id: BRAND_A },
      data: { slug: `${P}-brand-a-renamed` },
    });
    try {
      const replay = await provisionClientOrg(input);
      expect(replay.replayed).toBe(true);
      expect(replay.organization.id).toBe(first.organization.id);
    } finally {
      await prisma.organization.update({
        where: { id: BRAND_A },
        data: { slug: `${P}-brand-a` },
      });
    }
  });

  it('tombstoned replay surfaces a conflict (criterion 17)', async () => {
    const input = {
      parentOrgId: BRAND_A,
      externalRef: 'TOMB-1',
      clientName: 'Tomb Client',
      ownerEmail: `${P}-tomb-owner@synthex.test`,
      provisionedBy: ADMIN_A,
    };
    const first = await provisionClientOrg(input);
    await prisma.organization.update({
      where: { id: first.organization.id },
      data: { status: 'deleted' },
    });

    await expect(provisionClientOrg(input)).rejects.toMatchObject({
      name: 'ProvisionConflictError',
      reason: 'TOMBSTONED',
    });
  });

  // =========================================================================
  // Criteria 6, 8, 13 — evidence + spend edge, straight off a real provision
  // =========================================================================
  it('provision writes org-locked owner evidence + an ENFORCING budget policy', async () => {
    const ownerEmail = `${P}-evidence-owner@synthex.test`;
    const result = await provisionClientOrg({
      parentOrgId: BRAND_A,
      externalRef: 'EVID-1',
      clientName: 'Evidence Client',
      ownerEmail,
      provisionedBy: ADMIN_A,
    });
    const childId = result.organization.id;

    // Criterion 8: no log-only default survives.
    const policy = await prisma.orgBudgetPolicy.findUnique({
      where: { organizationId: childId },
    });
    expect(policy?.enforcementMode).toBe('enforce');
    expect(policy?.dailyCeilingUsd).toBeGreaterThan(0);
    expect(policy?.monthlyCeilingUsd).toBeGreaterThan(0);

    // Criterion 6: TeamInvitation-only, org-locked, role owner.
    const invitation = await prisma.teamInvitation.findFirst({
      where: { organizationId: childId },
    });
    expect(invitation?.email).toBe(ownerEmail);
    expect(invitation?.role).toBe('owner');
    expect(invitation?.organizationId).toBe(childId);

    // Criterion 13: the OAuth login gates admit the invitee, but the invite
    // cannot be parlayed into self-provisioning an unrelated org.
    await expect(hasInviteEvidence(ownerEmail)).resolves.toBe(true);
    await expect(hasSelfProvisionEvidence(ownerEmail)).resolves.toBe(false);
  });

  // =========================================================================
  // Criterion 12 — parent derivation + cross-tenant isolation (route plane)
  // =========================================================================
  it('a hostile body parentOrgId cannot select a foreign brand; siblings never see each other (criterion 12)', async () => {
    // Brand A admin provisions — body names brand B as parent. Ignored.
    mockGetUserId.mockResolvedValue(ADMIN_A);
    const res = await clientsPost(
      jsonRequest('http://localhost/api/command-centre/clients', {
        externalRef: 'XTEN-1',
        clientName: 'Cross Tenant Probe',
        ownerEmail: `${P}-xten-owner@synthex.test`,
        parentOrgId: BRAND_B,
      })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.organization.parentOrgId).toBe(BRAND_A);

    // Brand B's list must NOT contain brand A's child.
    mockGetUserId.mockResolvedValue(ADMIN_B);
    const listB = await (
      await clientsGet(
        jsonRequest('http://localhost/api/command-centre/clients')
      )
    ).json();
    expect(
      listB.children.find((c: { id: string }) => c.id === json.organization.id)
    ).toBeUndefined();

    // A child-org caller cannot provision (depth-2 cap).
    const childOwnerId = `${P}-xten-childowner`;
    await prisma.user.create({
      data: {
        id: childOwnerId,
        email: `${childOwnerId}@synthex.test`,
        organizationId: json.organization.id,
      },
    });
    mockGetUserId.mockResolvedValue(childOwnerId);
    const depthRes = await clientsPost(
      jsonRequest('http://localhost/api/command-centre/clients', {
        externalRef: 'XTEN-DEPTH',
        clientName: 'Grandchild Probe',
        ownerEmail: `${P}-grandchild@synthex.test`,
      })
    );
    expect(depthRes.status).toBe(403);
  });

  // =========================================================================
  // Criterion 5 — end-to-end suspension cut-off, each plane separately
  // =========================================================================
  it('offboard cuts every plane: keys, MCP status gate, withAuth, pointers, evidence, resolver, mint (criterion 5)', async () => {
    const ownerEmail = `${P}-cut-owner@synthex.test`;
    // Provision through the real route as brand A admin.
    mockGetUserId.mockResolvedValue(ADMIN_A);
    const provisionRes = await clientsPost(
      jsonRequest('http://localhost/api/command-centre/clients', {
        externalRef: 'CUT-1',
        clientName: 'Cutoff Client',
        ownerEmail,
      })
    );
    expect(provisionRes.status).toBe(201);
    const childId = (await provisionRes.json()).organization.id;

    // A collaborator living in the child org (simulates the accepted invitee).
    const collabId = `${P}-cut-collab`;
    await prisma.user.create({
      data: {
        id: collabId,
        email: `${collabId}@synthex.test`,
        organizationId: childId,
      },
    });

    // Child-tier MCP key via the REAL mint route — works pre-offboard.
    const mintRes = await mintPost(
      adminMintRequest({
        organizationId: childId,
        userId: collabId,
        label: 'itest-tb-child-key',
        scopes: ['creative'],
      })
    );
    expect(mintRes.status).toBe(201);
    const childKey = (await mintRes.json()).key;
    expect(
      (await resolveOrgFromBearer(`Bearer ${childKey}`))?.organizationId
    ).toBe(childId);

    // ---- OFFBOARD through the real route --------------------------------
    const offRes = await offboardPost(
      jsonRequest(
        `http://localhost/api/command-centre/clients/${childId}/offboard`,
        {}
      )
    );
    expect(offRes.status).toBe(200);
    const offJson = await offRes.json();
    expect(offJson.status).toBe('suspended');
    // The two v1 residuals are DOCUMENTED, not silently passed.
    expect(JSON.stringify(offJson.residuals)).toMatch(/session/i);
    expect(JSON.stringify(offJson.residuals)).toMatch(/image/i);

    // Plane (a): every key revoked; the minted key no longer authenticates.
    const keyRows = await prisma.mcpApiKey.findMany({
      where: { organizationId: childId },
    });
    expect(keyRows.length).toBeGreaterThan(0);
    expect(keyRows.every(k => k.revokedAt !== null)).toBe(true);
    expect(await resolveOrgFromBearer(`Bearer ${childKey}`)).toBeNull();

    // Plane (b): the ORG-STATUS gate itself — a fresh un-revoked key written
    // straight to the table (bypassing the mint route) still cannot auth.
    const backdoorRaw = `smk_${'e'.repeat(64)}`;
    await prisma.mcpApiKey.create({
      data: {
        keyHash: hashMcpKey(backdoorRaw),
        organizationId: childId,
        userId: collabId,
        label: 'itest-tb-backdoor',
        scopes: ['creative'],
      },
    });
    expect(await resolveOrgFromBearer(`Bearer ${backdoorRaw}`)).toBeNull();

    // Plane (d): EVERY member's home pointer neutralised.
    const members = await prisma.user.findMany({
      where: { id: { in: [collabId] } },
      select: { organizationId: true },
    });
    expect(members.every(m => m.organizationId === null)).toBe(true);

    // Plane (e): the provisioning invitation left the evidence set.
    const invite = await prisma.teamInvitation.findFirst({
      where: { organizationId: childId },
    });
    expect(invite?.status).toBe('revoked');
    await expect(hasInviteEvidence(ownerEmail)).resolves.toBe(false);

    // Planes (c) + (f): a straggler whose pointer survived (defense in depth).
    const stragglerId = `${P}-cut-straggler`;
    await prisma.user.create({
      data: {
        id: stragglerId,
        email: `${stragglerId}@synthex.test`,
        organizationId: childId,
      },
    });
    // (c) withAuth refuses with the TENANT_SUSPENDED contract.
    mockGetUserId.mockResolvedValue(stragglerId);
    const handler = jest.fn();
    const guarded = await withAuth(handler)(
      jsonRequest('http://localhost/api/anything', {})
    );
    expect(guarded.status).toBe(403);
    expect((await guarded.json()).code).toBe('TENANT_SUSPENDED');
    expect(handler).not.toHaveBeenCalled();
    // (f) the ~144-route resolver refuses the suspended org.
    await expect(getEffectiveOrganizationId(stragglerId)).resolves.toBeNull();

    // Mint refusal for the suspended org (spec §12).
    const remint = await mintPost(
      adminMintRequest({
        organizationId: childId,
        userId: collabId,
        label: 'itest-tb-remint',
        scopes: ['creative'],
      })
    );
    expect(remint.status).toBe(400);

    // Idempotent re-offboard still 200 (as brand A admin).
    mockGetUserId.mockResolvedValue(ADMIN_A);
    const again = await offboardPost(
      jsonRequest(
        `http://localhost/api/command-centre/clients/${childId}/offboard`,
        {}
      )
    );
    expect(again.status).toBe(200);
  }, 60_000);

  // =========================================================================
  // §14a — fan-out
  // =========================================================================
  it('50-child fan-out under one brand: all listed, none leak to the sibling', async () => {
    mockGetUserId.mockResolvedValue(ADMIN_B);
    for (let i = 0; i < 50; i++) {
      const result = await provisionClientOrg({
        parentOrgId: BRAND_B,
        externalRef: `FAN-${i}`,
        clientName: `Fan Client ${i}`,
        ownerEmail: `${P}-fan-${i}@synthex.test`,
        provisionedBy: ADMIN_B,
      });
      expect(result.replayed).toBe(false);
    }

    const list = await (
      await clientsGet(
        jsonRequest('http://localhost/api/command-centre/clients')
      )
    ).json();
    const fanChildren = list.children.filter((c: { name: string }) =>
      c.name.startsWith('Fan Client')
    );
    expect(fanChildren).toHaveLength(50);

    // Sibling brand sees none of them.
    mockGetUserId.mockResolvedValue(ADMIN_A);
    const listA = await (
      await clientsGet(
        jsonRequest('http://localhost/api/command-centre/clients')
      )
    ).json();
    expect(
      listA.children.filter((c: { name: string }) =>
        c.name.startsWith('Fan Client')
      )
    ).toHaveLength(0);
  }, 120_000);
});
