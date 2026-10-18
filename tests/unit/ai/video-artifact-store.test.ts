/** @jest-environment node */

/**
 * artifact-store: with no durable storage provisioned it refuses to store,
 * never writing to local disk or registering a media-library asset.
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

import {
  storeArtifact,
  ArtifactStorageNotProvisionedError,
} from '@/lib/services/ai/video/artifact-store';

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn() as never;
});

describe('storeArtifact', () => {
  it('throws FEATURE_NOT_PROVISIONED and stores nothing', async () => {
    await expect(
      storeArtifact({
        sourceUrl: 'https://provider.test/v.mp4',
        userId: 'user_1',
        rowId: 'vid_1',
      })
    ).rejects.toBeInstanceOf(ArtifactStorageNotProvisionedError);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockCreateAsset).not.toHaveBeenCalled();
  });
});
