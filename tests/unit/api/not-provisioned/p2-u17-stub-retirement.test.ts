/**
 * P2 u17 — retire lib/platform/server from:
 *   app/api/user/avatar/route.ts        avatars bucket via object-storage (FD-7);
 *                                       NOT_PROVISIONED without credentials
 *   app/api/system/models/route.ts      auth via lib/supabase-server (Prisma)
 *   lib/supabase-server.ts              query client NOT_PROVISIONED (throws)
 *   lib/security/audit-logger.ts        compliance events written synchronously, never pruned
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
const auditCreate = jest.fn();
const auditDeleteMany = jest.fn();
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
      deleteMany: (...a: unknown[]) => auditDeleteMany(...a),
    },
  },
}));

import { POST, DELETE, sniffImageType } from '@/app/api/user/avatar/route';
import { GET as getModels } from '@/app/api/system/models/route';
import {
  createServerClient,
  serverDb,
  getAuthUser,
  SupabaseClientRemovedError,
} from '@/lib/supabase-server';
import { auditLogger } from '@/lib/security/audit-logger';
import { logger } from '@/lib/logger';

const USER = 'user-a';
const PUBLIC = 'https://proj.supabase.co/storage/v1/object/public/avatars';
const ENV = { ...process.env };

// Real magic numbers per declared type, so the route's byte check sees a true image.
const MAGIC: Record<string, number[]> = {
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0],
  'image/jpeg': [0xff, 0xd8, 0xff, 0xe0, 0],
  'image/gif': [...Buffer.from('GIF89a'), 0],
  'image/webp': [...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')],
};
function avatarRequest(
  file?: { name: string; type: string; size: number },
  bytes?: number[]
) {
  const blob = file && {
    ...file,
    arrayBuffer: async () =>
      new Uint8Array(bytes ?? MAGIC[file.type] ?? [1, 2, 3]).buffer,
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

  it('500 on a DB failure never removes the previous avatar', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(42);
    userFindUnique.mockResolvedValue({ avatar: `${PUBLIC}/${USER}/1.png` });
    userUpdate.mockRejectedValue(new Error('db down'));
    await POST(avatarRequest({ name: 'me.png', type: 'image/png', size: 10 }));
    expect(mockStorageRemove.mock.calls).toEqual([
      ['avatars', [`${USER}/42.png`]],
    ]);
  });

  it("after a successful save removes the caller's previous bucket object", async () => {
    jest.spyOn(Date, 'now').mockReturnValue(42);
    userFindUnique.mockResolvedValue({ avatar: `${PUBLIC}/${USER}/1.png` });
    userUpdate.mockResolvedValue({});
    const res = await POST(
      avatarRequest({ name: 'me.png', type: 'image/png', size: 10 })
    );
    expect(res.status).toBe(200);
    expect(mockStorageRemove.mock.calls).toEqual([
      ['avatars', [`${USER}/1.png`]],
    ]);
    expect(userUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      mockStorageRemove.mock.invocationCallOrder[0]
    );
  });

  it.each([
    ['another user', `${PUBLIC}/user-b/1.png`],
    ['a prefix-sharing user', `${PUBLIC}/${USER}x/1.png`],
    ['a traversal', `${PUBLIC}/${USER}/../user-b/1.png`],
    [
      'another bucket',
      `https://proj.supabase.co/storage/v1/object/public/generated-videos/${USER}/1.png`,
    ],
    ['a legacy file', `/uploads/${USER}/1.png`],
  ])("a save never removes %s's previous object", async (_label, avatar) => {
    userFindUnique.mockResolvedValue({ avatar });
    userUpdate.mockResolvedValue({});
    const res = await POST(
      avatarRequest({ name: 'me.png', type: 'image/png', size: 10 })
    );
    expect(res.status).toBe(200);
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('a failed previous-avatar removal is logged and the save still succeeds', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(42);
    userFindUnique.mockResolvedValue({ avatar: `${PUBLIC}/${USER}/1.png` });
    userUpdate.mockResolvedValue({});
    mockStorageRemove.mockResolvedValue({
      data: null,
      error: { message: 'denied' },
    });
    const res = await POST(
      avatarRequest({ name: 'me.png', type: 'image/png', size: 10 })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).avatarUrl).toBe(`${PUBLIC}/${USER}/42.png`);
    expect(logger.error).toHaveBeenCalledWith(
      'Previous avatar cleanup failed',
      expect.objectContaining({ avatar: `${PUBLIC}/${USER}/1.png` })
    );
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

describe('POST /api/user/avatar byte check', () => {
  it('400 and no upload when the bytes are not the declared image type', async () => {
    for (const [type, bytes] of [
      ['image/png', [0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e]],
      ['image/jpeg', MAGIC['image/png']],
      [
        'image/webp',
        [...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WAVE')],
      ],
    ] as const) {
      const res = await POST(
        avatarRequest({ name: 'x', type, size: 10 }, [...bytes])
      );
      expect(res.status).toBe(400);
    }
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('detects each supported type from its magic number', () => {
    for (const t of ['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
      expect(sniffImageType(Buffer.from(MAGIC[t]))).toBe(t);
    expect(sniffImageType(Buffer.from('<svg>'))).toBeNull();
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

describe('auditLogger — compliance categories are written, kept, and labelled', () => {
  it('awaits the audit_logs row, labelled as having no immutable copy (A-24)', async () => {
    auditCreate.mockResolvedValue({ id: 'a1' });
    await auditLogger.logAuth('login', USER, 'success');
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'auth.login',
        category: 'auth',
        userId: USER,
        details: expect.objectContaining({
          immutableCopy: expect.stringContaining('FEATURE_NOT_PROVISIONED'),
        }),
      }),
    });
    await auditLogger.flush();
    expect(auditCreateMany).not.toHaveBeenCalled();
  });

  it('rejects when the audit row cannot be written', async () => {
    auditCreate.mockRejectedValue(new Error('audit db down'));
    await expect(
      auditLogger.logData('delete', 'competitor', 'c1', USER, 'success')
    ).rejects.toThrow('audit db down');
    await auditLogger.flush();
    expect(auditCreateMany).not.toHaveBeenCalled();
  });

  it('cleanup never prunes compliance categories', async () => {
    auditDeleteMany.mockResolvedValue({ count: 3 });
    await auditLogger.cleanup();
    const where = auditDeleteMany.mock.calls[0][0].where;
    expect(where.createdAt.lt).toBeInstanceOf(Date);
    expect(where.category.notIn).toEqual(
      expect.arrayContaining(['auth', 'security', 'data', 'compliance'])
    );
  });
});
