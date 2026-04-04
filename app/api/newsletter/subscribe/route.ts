import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { authStrict } from '@/lib/rate-limit';
import { sendNewsletterWelcome } from '@/lib/email/billing-emails';

const SubscribeSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
});

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

/**
 * POST /api/newsletter/subscribe
 *
 * Public (no auth required) — adds email to the Resend audience.
 * Rate limited to 5 req/min per IP (authStrict) to prevent abuse.
 */
export async function POST(req: NextRequest) {
  return authStrict(req, async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = SubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? 'Validation failed',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const audienceId = process.env.RESEND_AUDIENCE_ID;

    if (!audienceId) {
      // Graceful degradation — log and return success so the UI still works
      // in environments where the audience ID is not yet configured.
      console.warn(
        '[newsletter] RESEND_AUDIENCE_ID not set — skipping Resend audience add'
      );
      return NextResponse.json(
        { message: 'Subscribed successfully' },
        { status: 200 }
      );
    }

    const resend = getResend();

    const { error } = await resend.contacts.create({
      audienceId,
      email,
      unsubscribed: false,
    });

    if (error) {
      // Resend returns a specific error code when a contact already exists.
      // Treat "already subscribed" as a success from the user's perspective.
      if (
        typeof error === 'object' &&
        'name' in error &&
        (error as { name: string }).name === 'validation_error'
      ) {
        // Already subscribed — still 200 so the UI shows success
        return NextResponse.json(
          { message: 'Subscribed successfully' },
          { status: 200 }
        );
      }

      console.error('[newsletter] Resend error:', error);
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 }
      );
    }

    // Fire-and-forget welcome email — never block the response
    sendNewsletterWelcome(email);

    return NextResponse.json(
      { message: 'Subscribed successfully' },
      { status: 200 }
    );
  });
}
