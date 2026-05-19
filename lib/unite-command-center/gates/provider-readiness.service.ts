import type { ProviderReadiness } from '../ontology/command-ontology.schema';

export interface ProviderCredentialState {
  provider: string;
  credentialPresent: boolean;
  requiredForLive: boolean;
}

export function evaluateProviderReadiness(
  providers: ProviderCredentialState[]
): ProviderReadiness[] {
  return providers.map((provider) => {
    if (provider.credentialPresent) {
      return {
        provider: provider.provider,
        mode: 'live',
        reason: 'Credential is present. Value was not inspected or logged.',
      };
    }

    if (provider.requiredForLive) {
      return {
        provider: provider.provider,
        mode: 'blocked',
        reason: 'Live mode requires a credential that is not available.',
      };
    }

    return {
      provider: provider.provider,
      mode: 'draft',
      reason: 'Credential is absent, so the provider remains draft-only.',
    };
  });
}
