/**
 * Twilio SMS Provider
 *
 * Direct Twilio REST API implementation. No `twilio` npm package — fetch is
 * sufficient for the small surface we use (POST a Message resource, GET its
 * status). Keeps server bundle small (~600KB saved vs the SDK).
 *
 * Twilio API docs: https://www.twilio.com/docs/sms/api
 *
 * @see SYN-833 (parent: SYN-822 AEO epic)
 */

import { logger } from '@/lib/logger';
import type {
  SmsMessage,
  SmsProvider,
  SmsProviderConfig,
  SmsResult,
} from './types';

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

export class TwilioProvider implements SmsProvider {
  readonly name = 'twilio';
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly defaultFromNumber: string;

  constructor(config: SmsProviderConfig) {
    if (!config.twilio) {
      throw new Error('TwilioProvider: config.twilio block missing');
    }
    this.accountSid = config.twilio.accountSid;
    this.authToken = config.twilio.authToken;
    this.defaultFromNumber = config.twilio.fromNumber;
    this.validateConfig();
  }

  validateConfig(): void {
    if (!this.accountSid || !this.accountSid.startsWith('AC')) {
      throw new Error(
        'TwilioProvider: accountSid missing or malformed (expect "AC..." prefix)'
      );
    }
    if (!this.authToken || this.authToken.length < 32) {
      throw new Error('TwilioProvider: authToken missing or malformed');
    }
    if (!this.defaultFromNumber || !this.defaultFromNumber.startsWith('+')) {
      throw new Error(
        'TwilioProvider: fromNumber missing or not in E.164 format (expect "+..." prefix)'
      );
    }
  }

  async send(message: SmsMessage): Promise<SmsResult> {
    if (!message.sourceOfTruthJobId) {
      // Q3.2.4 H8 binding — every send must propagate the job ID
      throw new Error(
        'TwilioProvider.send: sourceOfTruthJobId required (Q3.2.4 H8)'
      );
    }
    if (!message.to || !message.to.startsWith('+')) {
      throw new Error(
        'TwilioProvider.send: `to` must be E.164 format (start with "+")'
      );
    }
    if (!message.body || message.body.length === 0) {
      throw new Error('TwilioProvider.send: `body` required');
    }

    const fromNumber = message.from || this.defaultFromNumber;
    const url = `${TWILIO_API_BASE}/Accounts/${this.accountSid}/Messages.json`;

    // Twilio expects form-urlencoded payload
    const params = new URLSearchParams();
    params.set('To', message.to);
    params.set('From', fromNumber);
    params.set('Body', message.body);

    const auth = Buffer.from(
      `${this.accountSid}:${this.authToken}`,
      'utf-8'
    ).toString('base64');

    let httpStatus = 0;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });
      httpStatus = res.status;
      const data = (await res.json().catch(() => ({}))) as {
        sid?: string;
        status?: string;
        message?: string;
        code?: number;
      };

      if (!res.ok) {
        // Audit-log: never log the body content (P10 binding)
        logger.warn('[sms.twilio] send failed', {
          sourceOfTruthJobId: message.sourceOfTruthJobId,
          brand: message.brand,
          httpStatus,
          twilioCode: data.code ?? null,
          twilioMessage: data.message ?? null,
          recipientHash: hashRecipient(message.to),
        });
        return {
          ok: false,
          providerMessageId: null,
          status: data.status || 'failed',
          httpStatus,
          error: data.message || `HTTP ${httpStatus}`,
          sourceOfTruthJobId: message.sourceOfTruthJobId,
        };
      }

      logger.info('[sms.twilio] send accepted', {
        sourceOfTruthJobId: message.sourceOfTruthJobId,
        brand: message.brand,
        twilioSid: data.sid ?? null,
        twilioStatus: data.status ?? null,
        recipientHash: hashRecipient(message.to),
      });

      return {
        ok: true,
        providerMessageId: data.sid || null,
        status: data.status || 'queued',
        httpStatus,
        sourceOfTruthJobId: message.sourceOfTruthJobId,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('[sms.twilio] send threw', {
        sourceOfTruthJobId: message.sourceOfTruthJobId,
        brand: message.brand,
        error: errorMessage,
        recipientHash: hashRecipient(message.to),
      });
      return {
        ok: false,
        providerMessageId: null,
        status: 'error',
        httpStatus,
        error: errorMessage,
        sourceOfTruthJobId: message.sourceOfTruthJobId,
      };
    }
  }

  async getStatus(providerMessageId: string): Promise<string | null> {
    if (!providerMessageId) return null;
    const url = `${TWILIO_API_BASE}/Accounts/${this.accountSid}/Messages/${providerMessageId}.json`;
    const auth = Buffer.from(
      `${this.accountSid}:${this.authToken}`,
      'utf-8'
    ).toString('base64');
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) return null;
      const data = (await res.json().catch(() => ({}))) as { status?: string };
      return data.status || null;
    } catch {
      return null;
    }
  }
}

/**
 * Hash a recipient phone number to short hex for audit logs.
 * P10 binding: the raw phone number must NEVER appear in logs.
 */
function hashRecipient(phone: string): string {
  // Lazy require to avoid pulling crypto into the type-export surface
  const crypto = require('node:crypto') as typeof import('node:crypto');
  return crypto.createHash('sha256').update(phone).digest('hex').slice(0, 12);
}
