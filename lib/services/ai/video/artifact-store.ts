/**
 * Persist a provider artifact (provider URLs expire).
 *
 * NOT PROVISIONED: no durable object storage is configured. Local disk
 * (lib/storage/platform-storage, public/uploads) does not survive restarts
 * or reach other instances, so storing there would mark a video 'rendered'
 * at a URL that later 404s. storeArtifact therefore throws, and the fal
 * webhook records the generation as failed with the provider URL kept in
 * metadata (the same outcome main had when this went through the noop
 * client).
 */
import { FEATURE_NOT_PROVISIONED } from '@/lib/api/not-provisioned';

export interface StoreArtifactInput {
  sourceUrl: string;
  userId: string;
  rowId: string; // VideoGeneration id, used as the storage filename
  prompt?: string;
  metadata?: Record<string, unknown>;
}

export class ArtifactStorageNotProvisionedError extends Error {
  readonly code = FEATURE_NOT_PROVISIONED;
  constructor() {
    super(
      `${FEATURE_NOT_PROVISIONED}: durable video storage is not provisioned; the artifact was not stored.`
    );
    this.name = 'ArtifactStorageNotProvisionedError';
  }
}

export async function storeArtifact(
  _input: StoreArtifactInput
): Promise<{ storedUrl: string }> {
  throw new ArtifactStorageNotProvisionedError();
}
