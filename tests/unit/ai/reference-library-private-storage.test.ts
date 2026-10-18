/** @jest-environment node */

/**
 * Private reference grounding over object storage (FD-7): the manifest is
 * read from the private bucket and only short-lived signed URLs come back.
 * Missing credentials or any storage failure resolve to [] with the reason
 * logged; a public URL is never returned.
 */

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockDownload = jest.fn();
const mockSign = jest.fn();
const mockGetPublicUrl = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: (bucket: string) => ({
        download: (...a: unknown[]) => mockDownload(bucket, ...a),
        createSignedUrls: (...a: unknown[]) => mockSign(bucket, ...a),
        getPublicUrl: (...a: unknown[]) => mockGetPublicUrl(bucket, ...a),
      }),
    },
  }),
}));

import { resolvePrivateReferenceUrls } from '@/lib/services/ai/reference-library-private';
import { logger } from '@/lib/logger';

const ENV = { ...process.env };
const SIGNED = (p: string) =>
  `https://proj.supabase.co/storage/v1/object/sign/reference-library-private/${p}?token=t`;

const MANIFEST = {
  version: 1,
  industries: {
    'carpet-cleaning': {
      subjects: {
        wand: {
          rights: 'owned',
          images: [
            { path: 'cc/a.webp', width: 1024, height: 1024 },
            { path: 'cc/huge.webp', width: 4096, height: 4096 },
            { path: 'cc/b.webp', width: 1024, height: 768 },
          ],
        },
        stock: {
          rights: 'licensed',
          images: [{ path: 'cc/l.webp', width: 10, height: 10 }],
        },
      },
    },
  },
};

function manifestBlob(m: unknown = MANIFEST) {
  return { data: new Blob([JSON.stringify(m)]), error: null };
}
function signedFor(paths: string[]) {
  return {
    data: paths.map(path => ({ path, signedUrl: SIGNED(path), error: null })),
    error: null,
  };
}

function expectUnavailable() {
  expect(logger.warn).toHaveBeenCalledWith(
    'private reference grounding unavailable',
    expect.objectContaining({ available: false, reason: expect.any(String) })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SUPABASE_URL = 'https://proj.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  mockDownload.mockResolvedValue(manifestBlob());
  mockSign.mockImplementation(async (_b: string, paths: string[]) =>
    signedFor(paths)
  );
});
afterAll(() => {
  process.env = ENV;
});

describe('resolvePrivateReferenceUrls', () => {
  it('reads the private manifest and returns signed URLs for owned, in-bound images', async () => {
    await expect(
      resolvePrivateReferenceUrls('carpet-cleaning', 4)
    ).resolves.toEqual([SIGNED('cc/a.webp'), SIGNED('cc/b.webp')]);
    expect(mockDownload).toHaveBeenCalledWith(
      'reference-library-private',
      '_private-manifest.json'
    );
    expect(mockSign).toHaveBeenCalledWith(
      'reference-library-private',
      ['cc/a.webp', 'cc/b.webp'],
      3600
    );
    expect(mockGetPublicUrl).not.toHaveBeenCalled();
  });

  it('respects max and returns [] for an industry with no owned images', async () => {
    await expect(
      resolvePrivateReferenceUrls('carpet-cleaning', 1)
    ).resolves.toEqual([SIGNED('cc/a.webp')]);
    await expect(resolvePrivateReferenceUrls('plumbing', 4)).resolves.toEqual(
      []
    );
  });

  it.each([['SUPABASE_URL'], ['SUPABASE_SERVICE_ROLE_KEY']])(
    'without %s logs FEATURE_NOT_PROVISIONED and returns []',
    async name => {
      delete process.env[name];
      await expect(
        resolvePrivateReferenceUrls('carpet-cleaning', 4)
      ).resolves.toEqual([]);
      expect(mockDownload).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'private reference grounding unavailable',
        expect.objectContaining({
          reason: expect.stringContaining('FEATURE_NOT_PROVISIONED'),
        })
      );
    }
  );

  it('a manifest download error resolves [] and is logged', async () => {
    mockDownload.mockResolvedValue({
      data: null,
      error: { message: 'Object not found' },
    });
    await expect(
      resolvePrivateReferenceUrls('carpet-cleaning', 4)
    ).resolves.toEqual([]);
    expect(mockSign).not.toHaveBeenCalled();
    expectUnavailable();
  });

  it('an unreadable manifest resolves []', async () => {
    mockDownload.mockResolvedValue({ data: new Blob(['{nope']), error: null });
    await expect(
      resolvePrivateReferenceUrls('carpet-cleaning', 4)
    ).resolves.toEqual([]);
    expectUnavailable();
  });

  it('a signing error resolves [] (no partial or public URLs)', async () => {
    mockSign.mockResolvedValue({ data: null, error: { message: 'denied' } });
    await expect(
      resolvePrivateReferenceUrls('carpet-cleaning', 4)
    ).resolves.toEqual([]);

    mockSign.mockResolvedValue({
      data: [
        { path: 'cc/a.webp', signedUrl: SIGNED('cc/a.webp'), error: null },
        { path: 'cc/b.webp', signedUrl: '', error: 'Object not found' },
      ],
      error: null,
    });
    await expect(
      resolvePrivateReferenceUrls('carpet-cleaning', 4)
    ).resolves.toEqual([]);
    expectUnavailable();
  });

  it('never returns a public object URL', async () => {
    mockSign.mockResolvedValue({
      data: [
        {
          path: 'cc/a.webp',
          signedUrl:
            'https://proj.supabase.co/storage/v1/object/public/reference-library-private/cc/a.webp',
          error: null,
        },
        { path: 'cc/b.webp', signedUrl: SIGNED('cc/b.webp'), error: null },
      ],
      error: null,
    });
    await expect(
      resolvePrivateReferenceUrls('carpet-cleaning', 4)
    ).resolves.toEqual([]);
    expectUnavailable();
  });
});
