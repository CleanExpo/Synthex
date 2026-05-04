/**
 * POST /api/webhooks/resend
 *
 * Handles Resend webhook events — SYN-673 + SYN-729 section 3
 *
 * Supported events:
 *   email.opened → fires:
 *                   1. `monthly_story_email_opened` to GA4 (existing — SYN-673)
 *                   2. CVML `view` event for monthly_story (NEW — SYN-729)
 *
 *                   Both are best-effort, fire-and-forget.
 *
 * Signature verification:
 *   Uses svix-style HMAC-SHA256 verification:
 *     message = `${svix-id}.${svix-timestamp}.${rawBody}`
 *     signature = HMAC-SHA256(secret, message) — compared to svix-signature header
 *
 * Required env vars:
 *   RESEND_WEBHOOK_SECRET   — from Resend dashboard → Webhooks → Signing secret
 *   GA4_MEASUREMENT_ID      — GA4 property measurement ID (G-XXXXXXX)
 *   GA4_API_SECRET          — GA4 Measurement Protocol API secret
 *
 * SYN-673, SYN-729
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { emit } from '@/lib/measurement/emit';

// ── GA4 Measurement Protocol ──────────────────────────────────────────────────

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

async function sendGa4Event(
  measurementId: string,
  apiSecret: string,
  clientId: string,
  eventName: string,
  eventParams: Record<string, string | number | boolean>
): Promise<void> {
  try {
    await fetch(
      `${GA4_ENDPOINT}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          events: [{ name: eventName, params: eventParams }],
        }),
      }
    );
  } catch (err) {
    console.error('[resend-webhook] GA4 event send failed:', err);
  }
}

// ── Signature verification ────────────────────────────────────────────────────

/**
 * Verify a Resend/svix webhook signature.
 * Algorithm: HMAC-SHA256( `${svixId}.${svixTimestamp}.${rawBody}` )
 * compared against base64v0 signatures in svix-signature header.
 */
function verifySvixSignature(
  secret: string,
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string
): boolean {
  // Resend signing secrets are prefixed with "whsec_" — strip it
  const secretBytes = Buffer.from(
    secret.startsWith('whsec_') ? secret.slice(6) : secret,
    'base64'
  );

  const message = `${svixId}.${svixTimestamp}.${rawBody}`;
  const hmac = crypto.createHmac('sha256', secretBytes);
  hmac.update(message);
  const computed = `v1,${hmac.digest('base64')}`;

  // svix-signature header may contain multiple space-separated sigs
  const signatures = svixSignature.split(' ');
  return signatures.some(sig =>
    crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(sig))
  );
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;

  // Reject if not configured
  if (!webhookSecret) {
    console.warn('[resend-webhook] RESEND_WEBHOOK_SECRET not set — rejecting');
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    );
  }

  // Extract svix headers
  const svixId = req.headers.get('svix-id') ?? '';
  const svixTimestamp = req.headers.get('svix-timestamp') ?? '';
  const svixSignature = req.headers.get('svix-signature') ?? '';

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: 'Missing svix headers' },
      { status: 400 }
    );
  }

  // Read raw body for signature verification
  const rawBody = await req.text();

  // Verify signature
  let isValid = false;
  try {
    isValid = verifySvixSignature(
      webhookSecret,
      rawBody,
      svixId,
      svixTimestamp,
      svixSignature
    );
  } catch {
    return NextResponse.json(
      { error: 'Signature verification failed' },
      { status: 401 }
    );
  }

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Parse body
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const eventType = event.type as string | undefined;

  // Handle email.opened
  if (eventType === 'email.opened') {
    const data = (event.data ?? {}) as Record<string, unknown>;
    const emailId = (data.email_id ?? svixId) as string;
    const tags = (data.tags ?? {}) as Record<string, string>;

    // tags.campaign_type is set by Synthex when sending emails via Resend
    // e.g. { campaign_type: 'monthly_story', month_year: '2026-03' }
    const campaignType = tags.campaign_type ?? 'unknown';
    const monthYear = tags.month_year ?? '';

    if (measurementId && apiSecret && campaignType === 'monthly_story') {
      // Use emailId as a stable client_id surrogate (NO user PII)
      const clientId = crypto
        .createHash('sha256')
        .update(emailId)
        .digest('hex')
        .slice(0, 32);

      await sendGa4Event(
        measurementId,
        apiSecret,
        clientId,
        'monthly_story_email_opened',
        {
          story_month: monthYear,
          email_id_hash: clientId, // re-use hashed emailId as a non-PII reference
        }
      );
    }

    // SYN-729 section 3 — CVML view emit for monthly_story.
    // The Resend tags (set in lib/email/monthly-story-email.ts) carry
    // org_id + story_id so we can attribute the open back to the right
    // organisation. Fire-and-forget: emit() never throws.
    if (campaignType === 'monthly_story') {
      const orgId = tags.org_id;
      const storyId = tags.story_id;
      if (orgId) {
        await emit({
          featureId: 'monthly_story',
          eventType: 'view',
          clientId: orgId,
          userId: null, // server-side, no user session on a webhook
          timestamp: new Date().toISOString(),
          sessionId: `resend-${emailId}`, // stable per-email sessionId surrogate
          metadata: {
            email_id: emailId,
            month_year: monthYear || null,
            story_id: storyId || null,
          },
          journey_moment_id: 'enhanced_monthly_story',
          journey_stage: 'monthly',
        });
      }
    }
  }

  return NextResponse.json({ ok: true, type: eventType ?? 'ignored' });
}
