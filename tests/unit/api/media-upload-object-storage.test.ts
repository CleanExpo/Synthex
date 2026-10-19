/** @jest-environment node */
/**
 * POST /api/media/upload stores into the private Supabase bucket
 * `media-uploads` (DECISIONS.md FD-7) through lib/storage/object-storage.
 *
 * Before: it called uploadToStorage (lib/storage/platform-storage.ts), which
 * writes to public/uploads on the local filesystem — read-only on Vercel, and
 * never persisted between instances.
 *
 * SEAM: the real route and the real object-storage helper; faked at the
 * Supabase client boundary, auth and logging. uploadToStorage is replaced by a
 * spy so a regression back to the local filesystem is caught.
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}));

const mockUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockUserId(...a),
}));

// resetMocks wipes jest.fn implementations, so the client shape is plain
// functions that delegate to per-test mocks.
const mockStorageUpload = jest.fn();
const mockCreateSignedUrls = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: (...a: unknown[]) => mockStorageUpload(bucket, ...a),
        createSignedUrls: (...a: unknown[]) =>
          mockCreateSignedUrls(bucket, ...a),
      }),
    },
  }),
}));

const mockLocalUpload = jest.fn();
jest.mock('@/lib/storage/platform-storage', () => ({
  ...jest.requireActual('@/lib/storage/platform-storage'),
  uploadToStorage: (...a: unknown[]) => mockLocalUpload(...a),
}));

import { POST } from '@/app/api/media/upload/route';

const USER = 'user-a';
const ENV = { ...process.env };
const SIGNED =
  'https://proj.supabase.co/storage/v1/object/sign/media-uploads/x?token=t';

function uploadRequest(file: File | null) {
  return {
    formData: async () => ({
      get: (name: string) => (name === 'file' ? file : null),
    }),
  } as never;
}

const png = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'My Logo.png', {
    type: 'image/png',
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId.mockResolvedValue(USER);
  process.env.SUPABASE_URL = 'https://proj.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-placeholder';
  mockStorageUpload.mockResolvedValue({ data: {}, error: null });
  mockCreateSignedUrls.mockImplementation(
    async (_bucket: string, paths: string[]) => ({
      data: paths.map(path => ({ path, signedUrl: SIGNED, error: null })),
      error: null,
    })
  );
});

afterAll(() => {
  process.env = ENV;
});

describe('POST /api/media/upload (media-uploads bucket)', () => {
  it('stores under the caller’s own prefix in media-uploads and returns a signed URL', async () => {
    const res = await POST(uploadRequest(png()));
    expect(res.status).toBe(201);

    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    const [bucket, path, , opts] = mockStorageUpload.mock.calls[0];
    expect(bucket).toBe('media-uploads');
    expect(path).toMatch(/^user-a\/\d+-My_Logo\.png$/);
    expect(opts).toMatchObject({ contentType: 'image/png', upsert: false });

    const { data } = await res.json();
    expect(data.url).toBe(SIGNED);
    expect(data.path).toBe(path);
    expect(data.mimeType).toBe('image/png');
    expect(data.size).toBe(4);
    expect(Number.isNaN(Date.parse(data.expiresAt))).toBe(false);

    expect(mockCreateSignedUrls.mock.calls[0][0]).toBe('media-uploads');
    expect(mockCreateSignedUrls.mock.calls[0][1]).toEqual([path]);
    expect(mockLocalUpload).not.toHaveBeenCalled();
  });

  it('503 FEATURE_NOT_PROVISIONED without storage credentials: saves nothing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await POST(uploadRequest(png()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('FEATURE_NOT_PROVISIONED');
    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(mockLocalUpload).not.toHaveBeenCalled();
  });

  it('a storage failure is a 500, never a fake success', async () => {
    mockStorageUpload.mockResolvedValue({
      data: null,
      error: { message: 'bucket not found' },
    });
    const res = await POST(uploadRequest(png()));
    expect(res.status).toBe(500);
    expect((await res.json()).data).toBeUndefined();
  });

  it('still validates the file before touching storage', async () => {
    const res = await POST(
      uploadRequest(new File(['x'], 'a.txt', { type: 'text/plain' }))
    );
    expect(res.status).toBe(400);
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it('401 without a user', async () => {
    mockUserId.mockResolvedValue(null);
    const res = await POST(uploadRequest(png()));
    expect(res.status).toBe(401);
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });
});
