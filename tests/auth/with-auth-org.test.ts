/**
 * WS2 — fail-closed auth tests
 *
 * Covers the privilege-escalation fix in lib/auth/with-auth.ts (kill
 * default-to-owner) and the new lib/auth/with-org.ts fail-closed org guard.
 *
 * Required cases (auth ladder 401 → 403 → 200, plus role resolution):
 *   - unresolved / unknown role  → DENIED elevation (resolves 'collaborator', NOT 'owner')
 *   - legitimate owner (no row)  → still 'owner'
 *   - explicit collaborator row  → 'collaborator'
 *   - withOrg: no session        → 401
 *   - withOrg: no active org     → 403 (fail closed, never silent default)
 *   - withOrg: legit owner        → 200, actingAsOwner true
 */

import { NextRequest, NextResponse } from 'next/server';

const findUnique = jest.fn();
const getUserId = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...args: unknown[]) => findUnique(...args) },
  },
}));

jest.mock('@/lib/auth/jwt-utils', () => ({
  __esModule: true,
  getUserIdFromRequestOrCookies: (...args: unknown[]) => getUserId(...args),
}));

import { resolveRole, withAuth, type AuthContext } from '@/lib/auth/with-auth';
import { withOrg, type OrgContext } from '@/lib/auth/with-org';

// The wrappers never read the request object in these paths, so a minimal stub
// avoids the jsdom Request polyfill clashing with NextRequest's read-only url.
const req = () => ({ url: 'https://synthex.social/api/x' }) as unknown as NextRequest;

beforeEach(() => {
  findUnique.mockReset();
  getUserId.mockReset();
});

// ── resolveRole (the core escalation fix) ────────────────────────────────────

describe('resolveRole — fail closed (kill default-to-owner)', () => {
  it('no membership row (undefined) → owner (legit direct org creator)', () => {
    expect(resolveRole(undefined)).toBe('owner');
  });

  it('no membership row (null) → owner', () => {
    expect(resolveRole(null)).toBe('owner');
  });

  it('explicit owner row → owner', () => {
    expect(resolveRole('owner')).toBe('owner');
  });

  it('explicit collaborator row → collaborator', () => {
    expect(resolveRole('collaborator')).toBe('collaborator');
  });

  it('UNKNOWN / corrupt role → collaborator, NOT owner (escalation denied)', () => {
    // This is the regression guard for the default-to-owner privilege escalation.
    expect(resolveRole('viewer')).toBe('collaborator');
    expect(resolveRole('admin')).toBe('collaborator');
    expect(resolveRole('superuser')).toBe('collaborator');
    expect(resolveRole('')).toBe('collaborator');
    expect(resolveRole('OWNER')).toBe('collaborator'); // case-sensitive — only exact 'owner'
  });
});

// ── withAuth role resolution end-to-end ──────────────────────────────────────

describe('withAuth — role injected into handler', () => {
  function captureRole() {
    let captured: AuthContext | undefined;
    const handler = withAuth(async (_r, auth) => {
      captured = auth;
      return NextResponse.json({ ok: true });
    });
    return { handler, get: () => captured };
  }

  it('legit owner (org set, no membership row) → role owner', async () => {
    getUserId.mockResolvedValue('u1');
    findUnique.mockResolvedValue({ organizationId: 'org1', teamMemberships: [] });
    const { handler, get } = captureRole();
    const res = await handler(req());
    expect(res.status).toBe(200);
    expect(get()?.role).toBe('owner');
  });

  it('collaborator membership row → role collaborator', async () => {
    getUserId.mockResolvedValue('u2');
    findUnique.mockResolvedValue({
      organizationId: 'org1',
      teamMemberships: [{ role: 'collaborator', organizationId: 'org1' }],
    });
    const { handler, get } = captureRole();
    await handler(req());
    expect(get()?.role).toBe('collaborator');
  });

  it('UNKNOWN role on membership row → collaborator (NOT owner)', async () => {
    getUserId.mockResolvedValue('u3');
    findUnique.mockResolvedValue({
      organizationId: 'org1',
      teamMemberships: [{ role: 'wat', organizationId: 'org1' }],
    });
    const { handler, get } = captureRole();
    await handler(req());
    expect(get()?.role).toBe('collaborator');
  });

  it('no session → 401', async () => {
    getUserId.mockResolvedValue(null);
    const handler = withAuth(async () => NextResponse.json({ ok: true }));
    const res = await handler(req());
    expect(res.status).toBe(401);
  });

  it('no active org → 403', async () => {
    getUserId.mockResolvedValue('u4');
    findUnique.mockResolvedValue({ organizationId: null, teamMemberships: [] });
    const handler = withAuth(async () => NextResponse.json({ ok: true }));
    const res = await handler(req());
    expect(res.status).toBe(403);
  });
});

// ── withOrg foundation ───────────────────────────────────────────────────────

describe('withOrg — fail-closed org-scoped guard', () => {
  function capture() {
    let captured: OrgContext | undefined;
    const handler = withOrg(async (_r, ctx) => {
      captured = ctx;
      return NextResponse.json({ ok: true });
    });
    return { handler, get: () => captured };
  }

  it('no session → 401', async () => {
    getUserId.mockResolvedValue(null);
    const { handler } = capture();
    const res = await handler(req());
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('authenticated but NO active org → 403 (fail closed, no default org)', async () => {
    getUserId.mockResolvedValue('u1');
    findUnique.mockResolvedValue({ organizationId: null, teamMemberships: [] });
    const { handler, get } = capture();
    const res = await handler(req());
    expect(res.status).toBe(403);
    expect(get()).toBeUndefined(); // handler never ran
  });

  it('legit owner → 200, org scoped, actingAsOwner true', async () => {
    getUserId.mockResolvedValue('u1');
    findUnique.mockResolvedValue({ organizationId: 'org1', teamMemberships: [] });
    const { handler, get } = capture();
    const res = await handler(req());
    expect(res.status).toBe(200);
    expect(get()?.org.id).toBe('org1');
    expect(get()?.role).toBe('owner');
    expect(get()?.actingAsOwner).toBe(true);
  });

  it('collaborator → 200, actingAsOwner false', async () => {
    getUserId.mockResolvedValue('u2');
    findUnique.mockResolvedValue({
      organizationId: 'org1',
      teamMemberships: [{ role: 'collaborator', organizationId: 'org1' }],
    });
    const { handler, get } = capture();
    await handler(req());
    expect(get()?.role).toBe('collaborator');
    expect(get()?.actingAsOwner).toBe(false);
  });

  it('unknown role on membership row → collaborator (no elevation)', async () => {
    getUserId.mockResolvedValue('u3');
    findUnique.mockResolvedValue({
      organizationId: 'org1',
      teamMemberships: [{ role: 'root', organizationId: 'org1' }],
    });
    const { handler, get } = capture();
    await handler(req());
    expect(get()?.role).toBe('collaborator');
    expect(get()?.actingAsOwner).toBe(false);
  });
});
