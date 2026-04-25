/**
 * POST /api/webhooks/twilio/inbound-call — SYN-802
 *
 * Twilio StatusCallback (inbound call completion) → Lead writer.
 *
 * Security:
 *   - Missing / invalid X-Twilio-Signature → 401
 *   - Called number not found in phone_pool → 404
 *   - Bad payload (missing From / CallSid) → 400
 *   - Returns 200 + empty TwiML body on success (Twilio expects 200)
 *
 * Lead attribution:
 *   - organizationId resolved via PhonePool.twilioPhoneE164 = Called
 *   - UTM recovery via dial_session_id is a future enhancement (SYN-803)
 *   - rawPayload stores the full Twilio form body for forensics
 *
 * Rate limits: reuses the existing per-IP + per-phone rate-limit helper
 * (namespace: "twilio-inbound").
 *
 * @task SYN-802
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { checkRateLimit, extractClientIp } from '@/lib/auth/rate-limit';
import {
  verifyTwilioSignature,
  parseTwilioFormBody,
} from '@/lib/auth/twilio-signature';

// ============================================================================
// Constants
// ============================================================================

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

// ============================================================================
// Handler
// ============================================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
  if (!authToken) {
    logger.error('[twilio-inbound] TWILIO_AUTH_TOKEN is not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  // ---- 1. Read raw body -------------------------------------------------------
  const rawBody = await req.text();
  const params = parseTwilioFormBody(rawBody);

  // ---- 2. Signature verification ----------------------------------------------
  const signature = req.headers.get('x-twilio-signature') ?? '';
  const url = req.url;

  const valid = verifyTwilioSignature(authToken, url, params, signature);

  if (!valid) {
    logger.warn('[twilio-inbound] Invalid signature', { url });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ---- 3. Payload validation --------------------------------------------------
  const callSid = params['CallSid'];
  const from = params['From'];    // caller E.164
  const called = params['Called']; // the Twilio number that was called
  const duration = params['CallDuration'];

  if (!callSid || !from || !called) {
    return NextResponse.json(
      { error: 'Missing required Twilio parameters: CallSid, From, Called' },
      { status: 400 }
    );
  }

  // ---- 4. Rate limit (per-IP + per-phone) ------------------------------------
  const ip = extractClientIp(req);
  const rl = await checkRateLimit(req, {
    orgKey: called,   // use called number as org proxy for rate-limiting
    ipKey: ip,
    namespace: 'twilio-inbound',
    limits: {
      org: { limit: 30, windowSeconds: 60 },  // 30 calls/min per number
      ip: { limit: 60, windowSeconds: 60 },
    },
  });

  if (!rl.ok) {
    return new NextResponse(null, {
      status: 429,
      headers: {
        'Retry-After': String(rl.retryAfterSeconds ?? 60),
      },
    });
  }

  // ---- 5. Resolve organisation via phone_pool --------------------------------
  const pool = await prisma.phonePool.findFirst({
    where: { twilioPhoneE164: called, active: true },
    select: { organizationId: true },
  });

  if (!pool) {
    logger.warn('[twilio-inbound] Unknown number — not in phone_pool', { called });
    return NextResponse.json({ error: 'Unknown number' }, { status: 404 });
  }

  // ---- 6. Write Lead ----------------------------------------------------------
  await prisma.lead.create({
    data: {
      organizationId: pool.organizationId,
      contactMethod: 'phone_call',
      capturedFrom: 'twilio_inbound_webhook',
      occurredAt: new Date(),
      source: 'phone',
      rawPayload: {
        CallSid: callSid,
        From: from,
        Called: called,
        CallDuration: duration ?? null,
        CallStatus: params['CallStatus'] ?? null,
        Direction: params['Direction'] ?? 'inbound',
        _raw: params,
      },
    },
  });

  logger.info('[twilio-inbound] Lead written', {
    callSid,
    organizationId: pool.organizationId,
  });

  // Twilio expects 200 with a valid TwiML body (or empty response)
  return new NextResponse(EMPTY_TWIML, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}
