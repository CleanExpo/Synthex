/** @jest-environment node */

/**
 * lib/storage/object-storage (FD-7): lazy Supabase Storage client, typed
 * FEATURE_NOT_PROVISIONED when credentials are missing, and every Supabase
 * error thrown rather than reported as success.
 */

const mockCreateClient = jest.fn();
const mockBucket = {
  upload: jest.fn(),
  getPublicUrl: jest.fn(),
  createSignedUrls: jest.fn(),
  download: jest.fn(),
  remove: jest.fn(),
};
// resetMocks wipes jest.fn implementations, so the bucket is returned by a
// plain function and mockFrom only records calls.
const mockFrom = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...a: unknown[]) => {
    mockCreateClient(...a);
    return {
      storage: {
        from: (...b: unknown[]) => {
          mockFrom(...b);
          return mockBucket;
        },
      },
    };
  },
}));

import * as storage from '@/lib/storage/object-storage';

const ENV = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SUPABASE_URL = 'https://proj.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
});
afterAll(() => {
  process.env = ENV;
});

describe('object-storage', () => {
  it('does not build a client at import', async () => {
    jest.resetModules();
    mockCreateClient.mockClear();
    await import('@/lib/storage/object-storage');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it.each([['SUPABASE_URL'], ['SUPABASE_SERVICE_ROLE_KEY']])(
    'throws FEATURE_NOT_PROVISIONED without %s and calls nothing',
    async name => {
      delete process.env[name];
      await expect(
        storage.upload('b', 'p', Buffer.from('x'), 'image/png')
      ).rejects.toMatchObject({ code: 'FEATURE_NOT_PROVISIONED' });
      expect(() => storage.publicUrl('b', 'p')).toThrow(
        storage.ObjectStorageNotProvisionedError
      );
      await expect(storage.download('b', 'p')).rejects.toBeInstanceOf(
        storage.ObjectStorageNotProvisionedError
      );
      expect(mockFrom).not.toHaveBeenCalled();
    }
  );

  it('upload passes contentType and upsert; an error is thrown', async () => {
    mockBucket.upload.mockResolvedValueOnce({ data: {}, error: null });
    const buf = Buffer.from('x');
    await storage.upload('avatars', 'u/1.png', buf, 'image/png', {
      upsert: true,
    });
    expect(mockFrom).toHaveBeenCalledWith('avatars');
    expect(mockBucket.upload).toHaveBeenCalledWith('u/1.png', buf, {
      contentType: 'image/png',
      upsert: true,
    });

    mockBucket.upload.mockResolvedValueOnce({
      data: null,
      error: { message: 'quota' },
    });
    await expect(
      storage.upload('avatars', 'u/1.png', buf, 'image/png')
    ).rejects.toThrow(storage.ObjectStorageError);
  });

  it('signedUrls keeps order and throws on any per-path error', async () => {
    mockBucket.createSignedUrls.mockResolvedValueOnce({
      data: [
        { path: 'a', signedUrl: 'https://s/a', error: null },
        { path: 'b', signedUrl: 'https://s/b', error: null },
      ],
      error: null,
    });
    await expect(storage.signedUrls('p', ['a', 'b'], 60)).resolves.toEqual([
      'https://s/a',
      'https://s/b',
    ]);

    mockBucket.createSignedUrls.mockResolvedValueOnce({
      data: [
        { path: 'a', signedUrl: 'https://s/a', error: null },
        { path: 'b', signedUrl: '', error: 'Object not found' },
      ],
      error: null,
    });
    await expect(storage.signedUrls('p', ['a', 'b'], 60)).rejects.toThrow(
      'Object not found'
    );

    mockBucket.createSignedUrls.mockResolvedValueOnce({
      data: null,
      error: { message: 'denied' },
    });
    await expect(storage.signedUrls('p', ['a'], 60)).rejects.toThrow('denied');
  });

  it('download returns a Buffer and throws on error', async () => {
    mockBucket.download.mockResolvedValueOnce({
      data: new Blob(['hello']),
      error: null,
    });
    expect((await storage.download('p', 'm.json')).toString()).toBe('hello');

    mockBucket.download.mockResolvedValueOnce({
      data: null,
      error: { message: 'not found' },
    });
    await expect(storage.download('p', 'm.json')).rejects.toThrow('not found');
  });

  it('remove and publicUrl surface errors', async () => {
    mockBucket.remove.mockResolvedValueOnce({
      data: null,
      error: { message: 'denied' },
    });
    await expect(storage.remove('b', ['x'])).rejects.toThrow('denied');

    mockBucket.getPublicUrl.mockReturnValueOnce({ data: { publicUrl: '' } });
    expect(() => storage.publicUrl('b', 'x')).toThrow(
      storage.ObjectStorageError
    );
  });
});
