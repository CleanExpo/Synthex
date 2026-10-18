/**
 * P2 u17 — retire lib/platform/server from:
 *   app/api/user/avatar/route.ts        avatars bucket via object-storage (FD-7);
 *                                       NOT_PROVISIONED without credentials
 *   app/api/system/models/route.ts      auth via lib/supabase-server (Prisma)
 *   lib/supabase-server.ts              query client NOT_PROVISIONED (throws)
 *   lib/security/audit-logger.ts        audit_events_immutable NOT_PROVISIONED
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

// Supabase Storage (FD-7). resetMocks wipes jest.fn implementations, so the
// client shape is plain functions that delegate to per-test mocks.
const mockStorageUpload = jest.fn();
const mockStorageRemove = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: (...a: unknown[]) => mockStorageUpload(bucket, ...a),
        remove: (...a: unknown[]) => mockStorageRemove(bucket, ...a),
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `https://proj.supabase.co/storage/v1/object/public/${bucket}/${path}`,
          },
        }),
      }),
    },
  }),
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
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      update: (...a: unknown[]) => userUpdate(...a),
      findUnique: (...a: unknown[]) => userFindUnique(...a),
    },
    auditLog: { createMany: (...a: unknown[]) => auditCreateMany(...a) },
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
import {
  auditLogger,
  ImmutableAuditUnavailableError,
} from '@/lib/security/audit-logger';
import { logger } from '@/lib/logger';

const USER = 'user-a';
const PUBLIC = 'https://proj.supabase.co/storage/v1/object/public/avatars';
const ENV = { ...process.env };

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
  process.env.SUPABASE_URL = 'https://proj.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  mockStorageUpload.mockResolvedValue({ data: {}, error: null });
  mockStorageRemove.mockResolvedValue({ data: [], error: null });
});

afterAll(async () => {
  process.env = ENV;
  await auditLogger.shutdown();
});

describe('POST /api/user/avatar (avatars bucket)', () => {
  it('401 without a user and never touches storage', async () => {
    mockUserIdFromRequest.mockResolvedValue(null);
    const res = await POST(
      avatarRequest({ name: 'a.png', type: 'image/png', size: 10 })
    );
    expect(res.status).toBe(401);
    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('uploads under the caller, extension from the MIME type, and saves the public URL', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    userUpdate.mockResolvedValue({});
    const res = await POST(
      avatarRequest({ name: 'evil.php', type: 'image/webp', size: 10 })
    );
    expect(res.status).toBe(200);
    const url = `${PUBLIC}/${USER}/1700000000000.webp`;
    expect(await res.json()).toMatchObject({ avatarUrl: url, avatar_url: url });
    expect(mockStorageUpload).toHaveBeenCalledWith(
      'avatars',
      `${USER}/1700000000000.webp`,
      expect.any(Buffer),
      { contentType: 'image/webp', upsert: false }
    );
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: USER },
      data: { avatar: url },
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('500 on a storage upload error and saves nothing', async () => {
    mockStorageUpload.mockResolvedValue({
      data: null,
      error: { message: 'bucket full' },
    });
    const res = await POST(
      avatarRequest({ name: 'me.png', type: 'image/png', size: 10 })
    );
    expect(res.status).toBe(500);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('500 on a DB failure and removes the uploaded object', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(42);
    userUpdate.mockRejectedValue(new Error('db down'));
    const res = await POST(
      avatarRequest({ name: 'me.png', type: 'image/png', size: 10 })
    );
    expect(res.status).toBe(500);
    expect(mockStorageRemove).toHaveBeenCalledWith('avatars', [
      `${USER}/42.png`,
    ]);
  });

  it('503 FEATURE_NOT_PROVISIONED without credentials: saves nothing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await POST(
      avatarRequest({ name: 'me.png', type: 'image/png', size: 10 })
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('FEATURE_NOT_PROVISIONED');
    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('still validates input before touching storage', async () => {
    const res = await POST(
      avatarRequest({ name: 'a.txt', type: 'text/plain', size: 10 })
    );
    expect(res.status).toBe(400);
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/user/avatar', () => {
  it("removes the caller's own bucket object and clears the row", async () => {
    userFindUnique.mockResolvedValue({ avatar: `${PUBLIC}/${USER}/1.png` });
    userUpdate.mockResolvedValue({});
    const res = await DELETE({} as never);
    expect(res.status).toBe(200);
    expect(mockStorageRemove).toHaveBeenCalledWith('avatars', [
      `${USER}/1.png`,
    ]);
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: USER },
      data: { avatar: null },
    });
  });

  it.each([
    ['another user', `${PUBLIC}/user-b/1.png`],
    ['a prefix-sharing user', `${PUBLIC}/${USER}x/1.png`],
    ['a traversal', `${PUBLIC}/${USER}/../user-b/1.png`],
    ['a nested path', `${PUBLIC}/${USER}/sub/1.png`],
    [
      'another bucket',
      `https://proj.supabase.co/storage/v1/object/public/generated-videos/${USER}/1.png`,
    ],
    [
      'another host',
      `https://evil.test/storage/v1/object/public/avatars/${USER}/1.png`,
    ],
  ])("never removes %s's object", async (_label, avatar) => {
    userFindUnique.mockResolvedValue({ avatar });
    userUpdate.mockResolvedValue({});
    await DELETE({} as never);
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('500 and keeps the row when the storage remove fails', async () => {
    userFindUnique.mockResolvedValue({ avatar: `${PUBLIC}/${USER}/1.png` });
    mockStorageRemove.mockResolvedValue({
      data: null,
      error: { message: 'denied' },
    });
    const res = await DELETE({} as never);
    expect(res.status).toBe(500);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('without credentials still clears legacy files and the row', async () => {
    delete process.env.SUPABASE_URL;
    userFindUnique.mockResolvedValue({ avatar: `/uploads/${USER}/1.png` });
    userUpdate.mockResolvedValue({});
    const res = await DELETE({} as never);
    expect(res.status).toBe(200);
    expect(mockStorageRemove).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledWith(`uploads/${USER}/1.png`);
  });

  it("deletes only a legacy file in the caller's own folder", async () => {
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

describe('auditLogger — audit_events_immutable not provisioned', () => {
  it('reports the missing immutable table and still records to audit_logs', async () => {
    auditCreateMany.mockResolvedValue({ count: 1 });
    await auditLogger.logAuth('login', USER, 'success');
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to write immutable audit event',
      expect.objectContaining({
        error: expect.any(ImmutableAuditUnavailableError),
      })
    );
    await auditLogger.flush();
    expect(auditCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ action: 'auth.login', userId: USER })],
      })
    );
  });
});
