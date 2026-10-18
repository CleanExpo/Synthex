/**
 * P2 u17 — retire lib/platform/server from:
 *   app/api/user/avatar/route.ts        POST NOT_PROVISIONED (no durable storage)
 *   app/api/system/models/route.ts      auth via lib/supabase-server (Prisma)
 *   lib/supabase-server.ts              query client NOT_PROVISIONED (throws)
 *   lib/security/audit-logger.ts        compliance events written to audit_events_immutable first
 */

/** @jest-environment node */

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockUserIdFromRequest = jest.fn();
const mockUserIdFromCookies = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) =>
    mockUserIdFromRequest(...a),
  getUserIdFromCookies: (...a: unknown[]) => mockUserIdFromCookies(...a),
}));

const mockUpload = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/lib/storage/platform-storage', () => ({
  uploadToStorage: (...a: unknown[]) => mockUpload(...a),
  deleteFromStorage: (...a: unknown[]) => mockDelete(...a),
}));

const userUpdate = jest.fn();
const userFindUnique = jest.fn();
const auditCreateMany = jest.fn();
const auditCreate = jest.fn();
const mockExecuteRaw = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      update: (...a: unknown[]) => userUpdate(...a),
      findUnique: (...a: unknown[]) => userFindUnique(...a),
    },
    auditLog: {
      createMany: (...a: unknown[]) => auditCreateMany(...a),
      create: (...a: unknown[]) => auditCreate(...a),
    },
    $executeRaw: (...a: unknown[]) => mockExecuteRaw(...a),
  },
}));

import { POST, DELETE } from '@/app/api/user/avatar/route';
import { GET as getModels } from '@/app/api/system/models/route';
import {
  createServerClient,
  serverDb,
  getAuthUser,
  SupabaseClientRemovedError,
} from '@/lib/supabase-server';
import { auditLogger } from '@/lib/security/audit-logger';

const USER = 'user-a';

function avatarRequest(file?: { name: string; type: string; size: number }) {
  const blob = file && {
    ...file,
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  };
  return {
    formData: async () => ({ get: () => blob ?? null }),
  } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUserIdFromRequest.mockResolvedValue(USER);
});

afterAll(async () => {
  await auditLogger.shutdown();
});

describe('POST /api/user/avatar (durable storage not provisioned)', () => {
  it('401 without a user and never touches storage', async () => {
    mockUserIdFromRequest.mockResolvedValue(null);
    const res = await POST(
      avatarRequest({ name: 'a.png', type: 'image/png', size: 10 })
    );
    expect(res.status).toBe(401);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('503 FEATURE_NOT_PROVISIONED: saves nothing to disk or the user row', async () => {
    const res = await POST(
      avatarRequest({ name: 'me.png', type: 'image/png', size: 10 })
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('FEATURE_NOT_PROVISIONED');
    expect(mockUpload).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('still validates input before answering not-provisioned', async () => {
    const res = await POST(
      avatarRequest({ name: 'a.txt', type: 'text/plain', size: 10 })
    );
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/user/avatar', () => {
  it("deletes only a file in the caller's own folder", async () => {
    userFindUnique.mockResolvedValue({
      avatar: `/uploads/${USER}/1-avatar.png`,
    });
    userUpdate.mockResolvedValue({});
    const res = await DELETE({} as never);
    expect(res.status).toBe(200);
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: USER },
      select: { avatar: true },
    });
    expect(mockDelete).toHaveBeenCalledWith(`uploads/${USER}/1-avatar.png`);
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: USER },
      data: { avatar: null },
    });
  });

  it("never deletes another user's file", async () => {
    userFindUnique.mockResolvedValue({
      avatar: '/uploads/user-b/1-avatar.png',
    });
    userUpdate.mockResolvedValue({});
    await DELETE({} as never);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe('GET /api/system/models auth', () => {
  it('401 when there is no session', async () => {
    mockUserIdFromCookies.mockResolvedValue(null);
    const res = await getModels({} as never);
    expect(res.status).toBe(401);
  });
});

describe('lib/supabase-server', () => {
  it('getAuthUser looks up only the cookie user', async () => {
    mockUserIdFromCookies.mockResolvedValue(USER);
    userFindUnique.mockResolvedValue({ id: USER, email: 'a@x.test' });
    await expect(getAuthUser()).resolves.toEqual({
      id: USER,
      email: 'a@x.test',
    });
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: USER },
      select: { id: true, email: true },
    });
  });

  it('getAuthUser surfaces DB failures instead of reporting "signed out"', async () => {
    mockUserIdFromCookies.mockResolvedValue(USER);
    userFindUnique.mockRejectedValue(new Error('db down'));
    await expect(getAuthUser()).rejects.toThrow('db down');
  });

  it('createServerClient throws a typed NOT_PROVISIONED error', () => {
    expect(() => createServerClient()).toThrow(SupabaseClientRemovedError);
  });

  it('serverDb reads and writes reject instead of returning empty data', async () => {
    await expect(serverDb.from('profiles').select()).rejects.toThrow(
      SupabaseClientRemovedError
    );
    await expect(serverDb.from('profiles').insert()).rejects.toMatchObject({
      code: 'FEATURE_NOT_PROVISIONED',
    });
  });
});

describe('auditLogger — compliance categories go to the immutable table first', () => {
  const ACTOR = '3f2b8c1e-9a4d-4e7b-8c2f-1a2b3c4d5e6f';
  const sql = () => (mockExecuteRaw.mock.calls[0][0] as string[]).join('?');
  const values = () => mockExecuteRaw.mock.calls[0].slice(1);

  it('writes audit_events_immutable, then the audit_logs copy, before resolving', async () => {
    const order: string[] = [];
    mockExecuteRaw.mockImplementation(async () => {
      order.push('immutable');
      return 1;
    });
    auditCreate.mockImplementation(async () => {
      order.push('audit_logs');
      return { id: 'a1' };
    });
    await auditLogger.logAuth('login', ACTOR, 'success');
    expect(order).toEqual(['immutable', 'audit_logs']);
    expect(sql()).toContain('INSERT INTO public.audit_events_immutable');
    expect(values()[0]).toBe('auth.login');
    expect(values()[1]).toBe(ACTOR);
    expect(JSON.parse(values()[2] as string)).toMatchObject({
      category: 'auth',
      outcome: 'success',
    });
    await auditLogger.flush();
    expect(auditCreateMany).not.toHaveBeenCalled();
  });

  it('keeps a non-uuid user id in the payload, not actor_id', async () => {
    mockExecuteRaw.mockResolvedValue(1);
    auditCreate.mockResolvedValue({ id: 'a1' });
    await auditLogger.logAuth('login', USER, 'success');
    expect(values()[1]).toBeNull();
    expect(JSON.parse(values()[2] as string).actor).toBe(USER);
  });

  it('rejects, and writes no audit_logs copy, when the immutable row fails', async () => {
    mockExecuteRaw.mockRejectedValue(new Error('immutable down'));
    await expect(
      auditLogger.logData('delete', 'competitor', 'c1', ACTOR, 'success')
    ).rejects.toThrow('immutable down');
    expect(auditCreate).not.toHaveBeenCalled();
    await auditLogger.flush();
    expect(auditCreateMany).not.toHaveBeenCalled();
  });

  it('resolves when only the secondary audit_logs copy fails', async () => {
    mockExecuteRaw.mockResolvedValue(1);
    auditCreate.mockRejectedValue(new Error('audit_logs down'));
    await expect(
      auditLogger.logData('delete', 'competitor', 'c1', ACTOR, 'success')
    ).resolves.toBeUndefined();
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
  });
});
