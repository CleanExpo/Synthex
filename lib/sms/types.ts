/**
 * SMS Provider Types
 *
 * Provider-agnostic SMS abstraction. Twilio is the first concrete provider
 * (lib/sms/twilio-provider.ts); future providers (Vonage, MessageBird, AWS SNS)
 * implement the same {@link SmsProvider} interface.
 *
 * @see SYN-833 (parent: SYN-822 AEO epic)
 * @see lib/sms/README.md for the contract + foundation rules (Q3.2.4 H8 binding)
 */

/**
 * Outbound SMS message.
 *
 * Foundation rule: every send MUST carry a `sourceOfTruthJobId` per Q3.2.4 H8.
 * The provider rejects sends that omit it.
 */
export interface SmsMessage {
  /** E.164-formatted recipient (e.g. "+61400000000"). */
  to: string;
  /** Body content. Must be pre-vetted by `brand-voice-enforce` upstream. */
  body: string;
  /**
   * Source-of-truth job ID per Q3.2.4 H8. Present on every send.
   * Propagated to provider metadata for audit + reply correlation.
   */
  sourceOfTruthJobId: string;
  /**
   * Brand for cross-brand frequency-cap pooling per
   * `marketing-operations-director` hard rule 3.
   */
  brand: 'DR' | 'NRPG' | 'RestoreAssist' | 'CARSI';
  /**
   * Optional override of provider's default `from` number. Most callers
   * omit this and let provider config decide.
   */
  from?: string;
}

/**
 * Provider response from a `send()` call.
 */
export interface SmsResult {
  /** True if the provider accepted the message (HTTP 2xx). */
  ok: boolean;
  /** Provider-assigned message ID (e.g. Twilio SID), or null on failure. */
  providerMessageId: string | null;
  /** Provider-reported status (e.g. "queued", "failed", "delivered"). */
  status: string;
  /** Provider HTTP status code. */
  httpStatus: number;
  /** Provider error message, present iff `ok === false`. */
  error?: string;
  /** Echoed source-of-truth job ID for audit-log correlation. */
  sourceOfTruthJobId: string;
}

/**
 * Provider configuration shape. Each provider validates its own subset.
 */
export interface SmsProviderConfig {
  provider: 'twilio' | 'noop';
  twilio?: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  };
}

/**
 * Provider interface. New providers (Vonage, MessageBird, AWS SNS) implement
 * this same shape so callers in `lib/notifications/` or workflow code can
 * swap providers via env config alone.
 */
export interface SmsProvider {
  /** Provider identifier, e.g. "twilio". */
  readonly name: string;
  /**
   * Send a single SMS. MUST log the source-of-truth job ID and brand for
   * audit. MUST NOT log the message body in plain text (privacy P10).
   */
  send(message: SmsMessage): Promise<SmsResult>;
  /**
   * Look up delivery status by provider message ID.
   * Returns null if the provider doesn't support status lookup.
   */
  getStatus(providerMessageId: string): Promise<string | null>;
  /**
   * Validate the provider's config block. Throws on missing/malformed config.
   * Called at construction time and in tests.
   */
  validateConfig(): void;
}
