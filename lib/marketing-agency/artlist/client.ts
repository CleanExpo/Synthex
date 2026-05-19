import type { ArtlistAudioRecommendation, ArtlistAudioRequest, ArtlistClientConfig } from './types';

export class ArtlistConfigurationError extends Error {
  constructor(message = 'Artlist Enterprise API credentials are required for live recommendations.') {
    super(message);
    this.name = 'ArtlistConfigurationError';
  }
}

export class ArtlistLiveIntegrationError extends Error {
  constructor() {
    super('Artlist live recommendations are not implemented until the Enterprise API contract is mapped.');
    this.name = 'ArtlistLiveIntegrationError';
  }
}

export function createArtlistClient(config: ArtlistClientConfig = {}) {
  return {
    async recommendAudio(_request: ArtlistAudioRequest): Promise<ArtlistAudioRecommendation> {
      if (!config.apiKey) {
        throw new ArtlistConfigurationError();
      }

      throw new ArtlistLiveIntegrationError();
    },
  };
}
