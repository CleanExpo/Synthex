/** @jest-environment node */

/**
 * artifact-store (FD-7): download -> generated-videos bucket -> public URL ->
 * media library row. Without storage credentials it refuses before
 * downloading; any download or storage error throws so the fal webhook marks
 * the generation failed, never 'rendered'.
 */

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockUpload = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: (...a: unknown[]) => mockUpload(bucket, ...a),
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `https://proj.supabase.co/storage/v1/object/public/${bucket}/${path}`,
          },
        }),
      }),
    },
  }),
}));
const mockLocalUpload = jest.fn();
jest.mock('@/lib/storage/platform-storage', () => ({
  uploadToStorage: (...a: unknown[]) => mockLocalUpload(...a),
}));
// The private-address check does DNS; the allowlist under test runs first.
let mockUnsafe = false;
jest.mock('@/lib/security/validate-url', () => ({
  assertExternalUrlSafe: async () => {
    if (mockUnsafe) throw new Error('private address');
  },
}));
const mockCreateAsset = jest.fn();
jest.mock('@/lib/services/media-library', () => ({
  mediaLibraryService: {
    createAsset: (...a: unknown[]) => mockCreateAsset(...a),
  },
}));

import {
  storeArtifact,
  falMediaUrl,
  ArtifactStorageNotProvisionedError,
} from '@/lib/services/ai/video/artifact-store';

const ENV = { ...process.env };
const INPUT = {
  sourceUrl: 'https://v3.fal.media/files/abc/v.mp4',
  userId: 'user_1',
  rowId: 'vid_1',
  prompt: 'p',
};
const STORED =
  'https://proj.supabase.co/storage/v1/object/public/generated-videos/user_1/vid_1.mp4';

function ok() {
  return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(4) };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SUPABASE_URL = 'https://proj.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  mockUnsafe = false;
  global.fetch = jest.fn(async () => ok()) as never;
  mockUpload.mockResolvedValue({ data: {}, error: null });
  mockCreateAsset.mockResolvedValue({});
});
afterEach(() => {
  jest.useRealTimers();
});
afterAll(() => {
  process.env = ENV;
});

describe('storeArtifact', () => {
  it('stores the video in generated-videos and returns its public URL', async () => {
    await expect(storeArtifact(INPUT)).resolves.toEqual({ storedUrl: STORED });
    expect(mockUpload).toHaveBeenCalledWith(
      'generated-videos',
      'user_1/vid_1.mp4',
      expect.any(Buffer),
      { contentType: 'video/mp4', upsert: true }
    );
    expect(mockCreateAsset).toHaveBeenCalledWith(
      'user_1',
      expect.objectContaining({ url: STORED, externalId: 'vid_1' })
    );
    expect(mockLocalUpload).not.toHaveBeenCalled();
  });

  it('a media-library failure is non-fatal once the video is stored', async () => {
    mockCreateAsset.mockRejectedValue(new Error('not provisioned'));
    await expect(storeArtifact(INPUT)).resolves.toEqual({ storedUrl: STORED });
  });

  it('an upload error throws and registers nothing', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'quota' } });
    await expect(storeArtifact(INPUT)).rejects.toThrow('quota');
    expect(mockCreateAsset).not.toHaveBeenCalled();
  });

  it('retries the download 3 times, then throws without uploading', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(async () => ({ ok: false, status: 502 })) as never;
    const p = storeArtifact(INPUT);
    const assertion = expect(p).rejects.toThrow('download 502');
    await jest.runAllTimersAsync();
    await assertion;
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it.each([['SUPABASE_URL'], ['SUPABASE_SERVICE_ROLE_KEY']])(
    'without %s throws FEATURE_NOT_PROVISIONED before downloading',
    async name => {
      delete process.env[name];
      await expect(storeArtifact(INPUT)).rejects.toBeInstanceOf(
        ArtifactStorageNotProvisionedError
      );
      await expect(storeArtifact(INPUT)).rejects.toMatchObject({
        code: 'FEATURE_NOT_PROVISIONED',
      });
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockUpload).not.toHaveBeenCalled();
      expect(mockLocalUpload).not.toHaveBeenCalled();
      expect(mockCreateAsset).not.toHaveBeenCalled();
    }
  );
});

describe('storeArtifact source URL guard (CodeQL js/request-forgery)', () => {
  it.each([
    'https://evil.example/v.mp4',
    'http://v3.fal.media/files/abc/v.mp4',
    'https://fal.media.evil.example/v.mp4',
    'https://fal.media.evil.com/v.mp4',
    'https://fal.media@evil.com/v.mp4',
    'https://v3.fal.media:8443/files/v.mp4',
    'https://other.fal.media/files/v.mp4',
    'https://169.254.169.254/latest/meta-data',
  ])('refuses %s before any request', async sourceUrl => {
    await expect(storeArtifact({ ...INPUT, sourceUrl })).rejects.toThrow(
      'not an allowed fal media host'
    );
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('refuses a fal host that resolves to a private address', async () => {
    mockUnsafe = true;
    await expect(storeArtifact(INPUT)).rejects.toThrow('private address');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rebuilds the URL from the constant host, keeping only path and query', async () => {
    await storeArtifact({
      ...INPUT,
      sourceUrl: 'https://v3b.fal.media/files/a/v.mp4?x=1#frag',
    });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      'https://v3b.fal.media/files/a/v.mp4?x=1'
    );
  });

  it('a lookalike hostname is never an allowed host', () => {
    expect(() => falMediaUrl('https://fal.media.evil.com/x.mp4')).toThrow(
      'not an allowed fal media host'
    );
  });

  it('never follows a redirect', async () => {
    await storeArtifact(INPUT);
    expect((global.fetch as jest.Mock).mock.calls[0][1]).toMatchObject({
      redirect: 'error',
    });
  });
});
