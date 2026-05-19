import { createArtlistClient } from './client';
import type { ArtlistAudioRecommendation, ArtlistAudioRequest } from './types';
import type { ProviderMode } from '../types';

export async function recommendArtlistAudio({
  providerMode,
  mood,
  durationSec,
  apiKey,
}: ArtlistAudioRequest & {
  providerMode: ProviderMode;
  apiKey?: string;
}): Promise<ArtlistAudioRecommendation> {
  if (providerMode === 'mock') {
    return {
      id: 'mock-artlist-audio-restoreassist-001',
      provider: 'artlist',
      providerMode: 'mock',
      title: 'Measured Recovery Pulse',
      artist: 'Mock Artlist',
      durationSec,
      licenceStatus: 'pending',
      sourceUrl: `mock://artlist/song/${encodeURIComponent(mood)}`,
    };
  }

  return createArtlistClient({ apiKey }).recommendAudio({ mood, durationSec });
}
