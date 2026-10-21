/**
 * Email suppression: the one place that answers "may this address receive
 * marketing email?" and records an unsubscribe.
 *
 * Two existing stores, no new table (a suppression table is founder-gated):
 *   1. Resend audience (RESEND_AUDIENCE_ID) — contact.unsubscribed.
 *   2. user.preferences.emailStatus — written by the SendGrid webhook
 *      ({ status: 'unsubscribed' | 'invalid' }) and by recordUnsubscribe().
 *
 * Fail closed: when either store cannot be read (audience not configured,
 * Resend error, database error, address not a Synthex user) the answer is
 * 'unknown', and callers must skip the send. A skipped send is recoverable;
 * mailing someone who unsubscribed is a Spam Act breach.
 */

import { Resend } from 'resend';
import prisma from '@/lib/prisma';

export type SuppressionStatus =
  | { state: 'allowed' }
  | { state: 'suppressed'; source: 'preferences' | 'resend' }
  | { state: 'unknown'; reason: string };

export type UnsubscribeStore = 'resend' | 'preferences';

export interface RecordUnsubscribeResult {
  /** Stores that now hold the unsubscribe. */
  recorded: UnsubscribeStore[];
  /** Stores that were available but whose write failed. */
  failed: UnsubscribeStore[];
}

const SUPPRESSED_PREFERENCE_STATUSES = ['unsubscribed', 'invalid'];

let _resend: Resend | null = null;
let _resendKey: string | undefined;
function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!_resend || _resendKey !== key) {
    _resend = new Resend(key);
    _resendKey = key;
  }
  return _resend;
}

function parsePreferences(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Malformed JSON — no emailStatus can be read from it.
    }
  }
  return {};
}

function preferencesSuppressed(raw: unknown): boolean {
  const emailStatus = parsePreferences(raw).emailStatus as
    | Record<string, unknown>
    | undefined;
  const status = emailStatus?.status;
  return (
    typeof status === 'string' &&
    SUPPRESSED_PREFERENCE_STATUSES.includes(status)
  );
}

function resendConfigured(): string | null {
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!audienceId || !process.env.RESEND_API_KEY) return null;
  return audienceId;
}

/**
 * Read both stores for `email`.
 *
 * Pass `preferences` when the caller already loaded the user's row (the
 * crons do); otherwise the user is looked up by email, and an address that is
 * not a Synthex user is 'unknown' (its consent cannot be shown).
 */
export async function getSuppressionStatus(
  email: string,
  opts: { preferences?: unknown } = {}
): Promise<SuppressionStatus> {
  let preferences: unknown;
  if ('preferences' in opts) {
    preferences = opts.preferences;
  } else {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { preferences: true },
      });
      if (!user) return { state: 'unknown', reason: 'recipient_not_a_user' };
      preferences = user.preferences;
    } catch {
      return { state: 'unknown', reason: 'preferences_read_failed' };
    }
  }

  if (preferencesSuppressed(preferences)) {
    return { state: 'suppressed', source: 'preferences' };
  }

  const audienceId = resendConfigured();
  if (!audienceId) {
    return { state: 'unknown', reason: 'resend_audience_not_configured' };
  }

  try {
    const { data, error } = await getResend().contacts.get({
      audienceId,
      email,
    });
    if (error) {
      // Not in the audience: Resend holds no unsubscribe for this address.
      if (error.name === 'not_found') return { state: 'allowed' };
      return { state: 'unknown', reason: `resend_${error.name}` };
    }
    if (!data) return { state: 'unknown', reason: 'resend_empty_response' };
    if (data.unsubscribed) return { state: 'suppressed', source: 'resend' };
    return { state: 'allowed' };
  } catch {
    return { state: 'unknown', reason: 'resend_read_failed' };
  }
}

/**
 * Write an unsubscribe to every store that is available: the Resend audience
 * (creating an unsubscribed contact if the address is not in it) and, when the
 * address belongs to a user, user.preferences.emailStatus in the shape the
 * SendGrid webhook writes.
 */
export async function recordUnsubscribe(
  email: string,
  method: 'one-click' | 'form' | 'json'
): Promise<RecordUnsubscribeResult> {
  const recorded: UnsubscribeStore[] = [];
  const failed: UnsubscribeStore[] = [];

  const audienceId = resendConfigured();
  if (audienceId) {
    try {
      const resend = getResend();
      const { error } = await resend.contacts.update({
        audienceId,
        email,
        unsubscribed: true,
      });
      if (!error) {
        recorded.push('resend');
      } else if (error.name === 'not_found') {
        const created = await resend.contacts.create({
          audienceId,
          email,
          unsubscribed: true,
        });
        if (created.error) failed.push('resend');
        else recorded.push('resend');
      } else {
        failed.push('resend');
      }
    } catch {
      failed.push('resend');
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, preferences: true },
    });
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          preferences: {
            ...parsePreferences(user.preferences),
            emailStatus: {
              status: 'unsubscribed',
              reason: 'unsubscribe',
              details: method,
              timestamp: new Date().toISOString(),
            },
          },
        },
      });
      recorded.push('preferences');
    }
  } catch {
    failed.push('preferences');
  }

  return { recorded, failed };
}
