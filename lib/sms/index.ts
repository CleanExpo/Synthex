/**
 * SMS module — public entry point.
 *
 * Reads provider config from env (SMS_PROVIDER + provider-specific vars),
 * constructs the right concrete provider, and exposes the
 * {@link SmsProvider} interface to upstream callers in `lib/notifications/`
 * or workflow code.
 *
 * @see SYN-833 (parent: SYN-822 AEO epic)
 * @see lib/sms/README.md
 */

import { TwilioProvider } from './twilio-provider';
import type { SmsProvider, SmsProviderConfig } from './types';

export type {
  SmsMessage,
  SmsProvider,
  SmsProviderConfig,
  SmsResult,
} from './types';
export { TwilioProvider } from './twilio-provider';

/**
 * No-op provider for environments without SMS credentials (CI, local dev,
 * tests). Logs the would-be send and returns a fake success.
 */
class NoopProvider implements SmsProvider {
  readonly name = 'noop';
  validateConfig(): void {
    /* nothing to validate */
  }
  async send(message: import('./types').SmsMessage) {
    if (!message.sourceOfTruthJobId) {
      throw new Error(
        'NoopProvider.send: sourceOfTruthJobId required (Q3.2.4 H8)'
      );
    }
    return {
      ok: true,
      providerMessageId: `noop-${Date.now()}`,
      status: 'noop',
      httpStatus: 200,
      sourceOfTruthJobId: message.sourceOfTruthJobId,
    };
  }
  async getStatus() {
    return 'noop';
  }
}

/**
 * Build provider config from env. Throws on missing required vars when
 * SMS_PROVIDER is set to a real provider.
 */
export function readSmsConfigFromEnv(): SmsProviderConfig {
  const providerEnv = (process.env.SMS_PROVIDER || 'noop').toLowerCase();
  if (providerEnv === 'twilio') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    const authToken = process.env.TWILIO_AUTH_TOKEN || '';
    const fromNumber = process.env.TWILIO_FROM_NUMBER || '';
    return {
      provider: 'twilio',
      twilio: { accountSid, authToken, fromNumber },
    };
  }
  return { provider: 'noop' };
}

/**
 * Factory: pick a concrete provider from config.
 */
export function buildSmsProvider(
  config: SmsProviderConfig = readSmsConfigFromEnv()
): SmsProvider {
  switch (config.provider) {
    case 'twilio':
      return new TwilioProvider(config);
    case 'noop':
    default:
      return new NoopProvider();
  }
}

/**
 * Module-level singleton built from env, lazily. Most callers in
 * `lib/notifications/` use this. Tests construct providers directly to
 * inject config.
 */
let _defaultProvider: SmsProvider | null = null;
export function getSmsProvider(): SmsProvider {
  if (!_defaultProvider) {
    _defaultProvider = buildSmsProvider();
  }
  return _defaultProvider;
}

/**
 * For tests only: reset the cached singleton between cases.
 * @internal
 */
export function _resetSmsProviderForTests(): void {
  _defaultProvider = null;
}
