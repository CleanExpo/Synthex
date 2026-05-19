import type { CampaignAsset } from '../types';

export function getMockArtlistAudioAsset(): CampaignAsset {
  return {
    id: 'mock-artlist-audio-restoreassist-001',
    assetType: 'audio',
    provider: 'artlist',
    providerAssetId: 'mock-song-001',
    sourceUrl: 'mock://artlist/song/mock-song-001',
    licenceStatus: 'pending',
  };
}
