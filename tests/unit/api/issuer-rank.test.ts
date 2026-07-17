/**
 * Unit tests — SYN-1108 shared issuer-rank guard
 *
 * The one guard reused by every issuance/acceptance writer. These cover the
 * rank matrix once, at the source, so each route only has to wire it in.
 */

import {
  ROLE_RANK,
  rankOfRole,
  requireIssuerOutranks,
  resolveIssuerRole,
} from '@/lib/auth/rbac/issuer-rank';

describe('ROLE_RANK ordering', () => {
  it('ranks owner > admin > editor > viewer', () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.editor);
    expect(ROLE_RANK.editor).toBeGreaterThan(ROLE_RANK.viewer);
  });
});

describe('rankOfRole', () => {
  it('maps canonical role names (case-insensitive)', () => {
    expect(rankOfRole('owner')).toBe(3);
    expect(rankOfRole('Admin')).toBe(2);
    expect(rankOfRole('EDITOR')).toBe(1);
    expect(rankOfRole('viewer')).toBe(0);
  });

  it('treats admin-granting permissions as admin rank regardless of name', () => {
    expect(rankOfRole({ name: 'Team Lead', permissions: ['manage_members'] })).toBe(2);
    expect(rankOfRole({ name: 'Custom', permissions: ['*'] })).toBe(2);
    expect(rankOfRole({ name: 'Ops', permissions: ['manage_roles'] })).toBe(2);
  });

  it('fails closed to viewer for unknown/corrupt/empty roles', () => {
    expect(rankOfRole('superadmin')).toBe(0);
    expect(rankOfRole(null)).toBe(0);
    expect(rankOfRole(undefined)).toBe(0);
    expect(rankOfRole({ name: '', permissions: [] })).toBe(0);
  });
});

describe('requireIssuerOutranks', () => {
  it('only an owner may grant owner', () => {
    expect(requireIssuerOutranks('owner', 'owner')).toBe(true);
    expect(requireIssuerOutranks('admin', 'owner')).toBe(false);
    expect(requireIssuerOutranks('editor', 'owner')).toBe(false);
    expect(requireIssuerOutranks('viewer', 'owner')).toBe(false);
  });

  it('requires the issuer to be at least the granted rank (never grant above yourself)', () => {
    expect(requireIssuerOutranks('owner', 'admin')).toBe(true);
    expect(requireIssuerOutranks('admin', 'editor')).toBe(true);
    expect(requireIssuerOutranks('admin', 'viewer')).toBe(true);
    // Equal rank is allowed — peer admin management is legitimate.
    expect(requireIssuerOutranks('admin', 'admin')).toBe(true);
    expect(requireIssuerOutranks('editor', 'editor')).toBe(true);
    // Granting above your own rank is refused.
    expect(requireIssuerOutranks('editor', 'admin')).toBe(false);
    expect(requireIssuerOutranks('viewer', 'editor')).toBe(false);
  });

  it('accepts Role-like objects on the granted side', () => {
    expect(requireIssuerOutranks('admin', { name: 'Editor', permissions: [] })).toBe(true);
    // A custom role carrying the admin wildcard ranks as admin — an admin may
    // seat a peer admin, but an editor may not.
    expect(requireIssuerOutranks('admin', { name: 'Custom', permissions: ['*'] })).toBe(true);
    expect(requireIssuerOutranks('editor', { name: 'Custom', permissions: ['*'] })).toBe(false);
  });
});

describe('resolveIssuerRole', () => {
  const USER = 'u1';
  const ORG = 'org1';

  function makeDb(overrides: Record<string, unknown> = {}) {
    return {
      businessOwnership: { findFirst: jest.fn().mockResolvedValue(null) },
      teamMember: { findUnique: jest.fn().mockResolvedValue(null) },
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
      ...overrides,
    } as never;
  }

  it('returns owner when an ACTIVE BusinessOwnership row exists', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'own1' });
    const db = makeDb({ businessOwnership: { findFirst } });
    expect(await resolveIssuerRole(USER, ORG, db)).toBe('owner');
    // The ownership lookup must filter to active rows only.
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  it('does NOT confer owner from a DEACTIVATED ownership — resolves to next-highest role', async () => {
    // The isActive:true filter excludes the cancelled ownership, so findFirst
    // returns null; the actor falls back to their highest RBAC role (admin).
    const db = makeDb({
      businessOwnership: { findFirst: jest.fn().mockResolvedValue(null) },
      userRole: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ role: { name: 'Admin', permissions: ['*'] } }]),
      },
    });
    expect(await resolveIssuerRole(USER, ORG, db)).toBe('admin');
  });

  it('returns owner when TeamMember role is owner', async () => {
    const db = makeDb({
      teamMember: { findUnique: jest.fn().mockResolvedValue({ role: 'owner' }) },
    });
    expect(await resolveIssuerRole(USER, ORG, db)).toBe('owner');
  });

  it('returns the highest RBAC role when not an owner', async () => {
    const db = makeDb({
      userRole: {
        findMany: jest.fn().mockResolvedValue([
          { role: { name: 'Viewer', permissions: ['posts:read'] } },
          { role: { name: 'Admin', permissions: ['*'] } },
        ]),
      },
    });
    expect(await resolveIssuerRole(USER, ORG, db)).toBe('admin');
  });

  it('fails closed to viewer when no signal and on error', async () => {
    expect(await resolveIssuerRole(USER, ORG, makeDb())).toBe('viewer');
    const throwing = {
      businessOwnership: {
        findFirst: jest.fn().mockRejectedValue(new Error('db down')),
      },
    } as never;
    expect(await resolveIssuerRole(USER, ORG, throwing)).toBe('viewer');
  });

  it('does not throw when models are absent from the client (partial mocks)', async () => {
    expect(await resolveIssuerRole(USER, ORG, {} as never)).toBe('viewer');
  });
});
