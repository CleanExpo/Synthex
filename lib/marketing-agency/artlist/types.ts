import type { LicenceStatus, ProviderMode } from '../types';

export interface ArtlistAudioRequest {
  mood: string;
  durationSec: number;
}

export interface ArtlistAudioRecommendation {
  id: string;
  provider: 'artlist';
  providerMode: ProviderMode;
  title: string;
  artist: string;
  durationSec: number;
  licenceStatus: LicenceStatus;
  sourceUrl?: string;
}

export interface ArtlistClientConfig {
  apiKey?: string;
}
