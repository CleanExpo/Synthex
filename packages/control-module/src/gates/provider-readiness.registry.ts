import {
  evaluateProviderReadiness,
  type ProviderCredentialState,
} from './provider-readiness.service';

export interface ProviderEnvironment {
  [key: string]: string | undefined;
}

const PROVIDER_ENV_KEYS: Record<string, string[]> = {
  plaud: ['PLAUD_API_KEY', 'PLAUD_TOKEN'],
  telegram: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
  pipedream: ['PIPEDREAM_API_KEY', 'PIPEDREAM_CLIENT_ID'],
  whatsapp: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
  apify: ['APIFY_API_TOKEN'],
  heygen: ['HEYGEN_API_KEY'],
  artlist: ['ARTLIST_API_KEY'],
};

const REQUIRED_FOR_LIVE = new Set(['telegram', 'whatsapp', 'heygen']);

export function getCommandCentreProviderReadiness(env: ProviderEnvironment) {
  const providers: ProviderCredentialState[] = Object.entries(
    PROVIDER_ENV_KEYS
  ).map(([provider, keys]) => ({
    provider,
    credentialPresent: keys.every(key => Boolean(env[key])),
    requiredForLive: REQUIRED_FOR_LIVE.has(provider),
  }));

  return evaluateProviderReadiness(providers);
}

export function getProviderEnvKeyNames(): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(PROVIDER_ENV_KEYS).map(([provider, keys]) => [
      provider,
      [...keys],
    ])
  );
}
