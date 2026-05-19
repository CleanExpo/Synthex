import type { HeyGenAvatarVideoJob, HeyGenAvatarVideoRequest, HeyGenClientConfig } from './types';

export class HeyGenConfigurationError extends Error {
  constructor(message = 'HeyGen API credentials are required for live avatar video generation.') {
    super(message);
    this.name = 'HeyGenConfigurationError';
  }
}

export class HeyGenConsentError extends Error {
  constructor(message = 'Consent metadata is required before real-person likeness generation.') {
    super(message);
    this.name = 'HeyGenConsentError';
  }
}

export class HeyGenLiveIntegrationError extends Error {
  constructor() {
    super('HeyGen live avatar video generation is blocked until the API contract and webhook flow are mapped.');
    this.name = 'HeyGenLiveIntegrationError';
  }
}

export function createHeyGenClient(config: HeyGenClientConfig = {}) {
  return {
    async createAvatarVideo(request: HeyGenAvatarVideoRequest): Promise<HeyGenAvatarVideoJob> {
      if (!request.consent) {
        throw new HeyGenConsentError();
      }

      if (!config.apiKey) {
        throw new HeyGenConfigurationError();
      }

      throw new HeyGenLiveIntegrationError();
    },
  };
}
