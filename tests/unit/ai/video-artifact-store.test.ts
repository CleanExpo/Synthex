/** @jest-environment node */

/**
 * p2-u14: artifact-store persists through the repo's platform storage helper
 * instead of the noop-client bucket, and surfaces upload failure.
 */

const mockUpload = jest.fn();
jest.mock('@/lib/storage/platform-storage', () => ({
  uploadToStorage: (...a: unknown[]) => mockUpload(...a),
}));
const mockCreateAsset = jest.fn();
jest.mock('@/lib/services/media-library', () => ({
  mediaLibraryService: {
    createAsset: (...a: unknown[]) => mockCreateAsset(...a),
  },
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { storeArtifact } from '@/lib/services/ai/video/artifact-store';

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(4),
  }) as never;
  mockCreateAsset.mockResolvedValue({});
});

describe('storeArtifact', () => {
  it('uploads the video under the owning user and returns its stored URL', async () => {
    mockUpload.mockResolvedValue({ url: '/uploads/user_1/1-vid_1.mp4' });

    const { storedUrl } = await storeArtifact({
      sourceUrl: 'https://provider.test/v.mp4',
      userId: 'user_1',
      rowId: 'vid_1',
    });

    expect(storedUrl).toBe('/uploads/user_1/1-vid_1.mp4');
    expect(mockUpload).toHaveBeenCalledWith(
      'user_1',
      'vid_1.mp4',
      expect.any(Buffer),
      'video/mp4'
    );
    expect(mockCreateAsset).toHaveBeenCalledWith(
      'user_1',
      expect.objectContaining({ url: storedUrl, externalId: 'vid_1' })
    );
  });

  it('fails loudly when the upload fails', async () => {
    mockUpload.mockRejectedValue(new Error('disk full'));

    await expect(
      storeArtifact({
        sourceUrl: 'https://provider.test/v.mp4',
        userId: 'u',
        rowId: 'r',
      })
    ).rejects.toThrow('video upload failed: disk full');
    expect(mockCreateAsset).not.toHaveBeenCalled();
  });
});
