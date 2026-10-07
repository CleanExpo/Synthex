/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET as EXPORT } from '@/app/api/opportunity-proposals/[id]/export/route';
import { GET, POST, PATCH } from '@/app/api/opportunity-proposals/route';
import { APISecurityChecker } from '@/lib/security/api-security-checker';
import { database } from './test-store';
import { proposalFixture } from './fixtures';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: { check: jest.fn() },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { name: 'read' },
    AUTHENTICATED_WRITE: { name: 'write' },
  },
}));
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  prisma: { commandPacket: { findMany: jest.fn() }, $transaction: jest.fn() },
}));

beforeEach(() => {
  (APISecurityChecker.check as jest.Mock).mockResolvedValue({
    allowed: true,
    context: { userId: 'session-user' },
  });
  (getEffectiveOrganizationId as jest.Mock).mockResolvedValue('effective-org');
  const { prisma } = require('@/lib/prisma');
  Object.assign(prisma, database());
});
test('unauthenticated listing fails closed', async () => {
  (APISecurityChecker.check as jest.Mock).mockResolvedValue({
    allowed: false,
    error: 'Authentication required',
    context: {},
  });
  const response = await GET(
    new NextRequest('https://synthex.test/api/opportunity-proposals')
  );
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: 'Authentication required' });
});

test('listing reads the effective organisation rather than caller-supplied scope', async () => {
  const { prisma } = await import('@/lib/prisma');
  jest
    .spyOn(prisma.commandPacket, 'findMany')
    .mockImplementation(async ({ where }) => {
      if (where.organizationId !== 'effective-org') return [];
      throw new Error('Store temporarily unavailable');
    });
  const response = await GET(
    new NextRequest(
      'https://synthex.test/api/opportunity-proposals?organizationId=attacker-org'
    )
  );
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: 'Unable to process opportunity proposal',
  });
});

test('authenticated capture returns a durable record and idempotent retries reuse it', async () => {
  const body = {
    clientRequestId: 'f14a399b-d3eb-4507-9f92-736fc96aee81',
    proposal: proposalFixture,
  };
  const request = () =>
    new NextRequest('https://synthex.test/api/opportunity-proposals', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  const saved = await POST(request());
  expect(saved.status).toBe(201);
  const first = await saved.json();
  expect(first).toMatchObject({
    created: true,
    item: { revision: 1, review: { state: 'pending' }, executionBlocked: true },
  });
  const retry = await POST(request());
  expect(retry.status).toBe(200);
  expect(await retry.json()).toMatchObject({
    created: false,
    item: { id: first.item.id },
  });
  const list = await GET(
    new NextRequest('https://synthex.test/api/opportunity-proposals')
  );
  expect(await list.json()).toMatchObject({
    total: 1,
    items: [{ id: first.item.id }],
  });
});

test('review API requires revision and export only serves explicitly accepted proposals', async () => {
  const saved = await POST(
    new NextRequest('https://synthex.test/api/opportunity-proposals', {
      method: 'POST',
      body: JSON.stringify({
        clientRequestId: 'f14a399b-d3eb-4507-9f92-736fc96aee81',
        proposal: proposalFixture,
      }),
    })
  );
  const { item } = await saved.json();
  const route = { params: Promise.resolve({ id: item.id }) };
  const exportRequest = new NextRequest(
    `https://synthex.test/api/opportunity-proposals/${item.id}/export`
  );
  const reviewed = await PATCH(
    new NextRequest('https://synthex.test/api/opportunity-proposals', {
      method: 'PATCH',
      body: JSON.stringify({
        id: item.id,
        expectedRevision: 1,
        action: 'accept',
        note: 'Ready for manual Nexus review.',
      }),
    })
  );
  expect(reviewed.status).toBe(200);
  expect(await reviewed.json()).toMatchObject({
    item: {
      revision: 2,
      review: { state: 'accepted' },
      status: 'pending',
      executionBlocked: true,
    },
  });
  const exported = await EXPORT(exportRequest, route);
  expect(exported.status).toBe(200);
  expect(await exported.json()).toMatchObject({
    packetId: item.id,
    revision: 2,
    review: { state: 'accepted' },
    executionBlocked: true,
  });
  const stale = await PATCH(
    new NextRequest('https://synthex.test/api/opportunity-proposals', {
      method: 'PATCH',
      body: JSON.stringify({
        id: item.id,
        expectedRevision: 1,
        action: 'reject',
        note: 'Stale decision',
      }),
    })
  );
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({ code: 'revision_conflict' });
});

const captureRequest = () =>
  new NextRequest('https://synthex.test/api/opportunity-proposals', {
    method: 'POST',
    body: JSON.stringify({
      clientRequestId: 'f14a399b-d3eb-4507-9f92-736fc96aee81',
      proposal: proposalFixture,
    }),
  });

test.each(['list', 'capture', 'review', 'export'])(
  '%s denies authentication failures before accessing proposals',
  async method => {
    (APISecurityChecker.check as jest.Mock).mockResolvedValue({
      allowed: false,
      error: 'Authentication required',
      context: {},
    });
    const response =
      method === 'list'
        ? await GET(
            new NextRequest('https://synthex.test/api/opportunity-proposals')
          )
        : method === 'capture'
          ? await POST(captureRequest())
          : method === 'review'
            ? await PATCH(
                new NextRequest(
                  'https://synthex.test/api/opportunity-proposals',
                  { method: 'PATCH', body: '{}' }
                )
              )
            : await EXPORT(
                new NextRequest(
                  'https://synthex.test/api/opportunity-proposals/id/export'
                ),
                { params: Promise.resolve({ id: 'id' }) }
              );
    expect(response.status).toBe(401);
  }
);

test('missing effective organisation fails closed', async () => {
  (getEffectiveOrganizationId as jest.Mock).mockResolvedValue(null);
  const response = await POST(captureRequest());
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'No organisation found' });
});

test('malformed JSON and forged caller scope fail validation', async () => {
  const malformed = await POST(
    new NextRequest('https://synthex.test/api/opportunity-proposals', {
      method: 'POST',
      body: '{',
    })
  );
  expect(malformed.status).toBe(400);
  expect(await malformed.json()).toEqual({ error: 'Malformed JSON' });
  const forged = await POST(
    new NextRequest('https://synthex.test/api/opportunity-proposals', {
      method: 'POST',
      body: JSON.stringify({
        clientRequestId: 'f14a399b-d3eb-4507-9f92-736fc96aee81',
        proposal: proposalFixture,
        organizationId: 'attacker-org',
        executionBlocked: false,
      }),
    })
  );
  expect(forged.status).toBe(400);
  expect(await forged.json()).toMatchObject({ error: 'Validation failed' });
  const invalid = await PATCH(
    new NextRequest('https://synthex.test/api/opportunity-proposals', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'id',
        action: 'accept',
        note: 'Missing revision',
      }),
    })
  );
  expect(invalid.status).toBe(400);
});

test('pending and cross-organisation exports fail with review required or not found', async () => {
  const saved = await POST(captureRequest());
  const { item } = await saved.json();
  const route = { params: Promise.resolve({ id: item.id }) };
  const request = new NextRequest(
    `https://synthex.test/api/opportunity-proposals/${item.id}/export`
  );
  const pending = await EXPORT(request, route);
  expect(pending.status).toBe(409);
  expect(await pending.json()).toMatchObject({ code: 'review_required' });
  (getEffectiveOrganizationId as jest.Mock).mockResolvedValue('other-org');
  const hidden = await EXPORT(request, route);
  expect(hidden.status).toBe(404);
  expect(await hidden.json()).toMatchObject({ code: 'not_found' });
  const review = await PATCH(
    new NextRequest('https://synthex.test/api/opportunity-proposals', {
      method: 'PATCH',
      body: JSON.stringify({
        id: item.id,
        expectedRevision: 1,
        action: 'accept',
        note: 'Cross-org attempt',
      }),
    })
  );
  expect(review.status).toBe(404);
  const list = await GET(
    new NextRequest('https://synthex.test/api/opportunity-proposals')
  );
  expect(await list.json()).toEqual({ items: [], total: 0 });
});
