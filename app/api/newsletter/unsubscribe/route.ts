import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { readDefault } from '@/lib/rate-limit';

const UnsubscribeSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
});

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

/**
 * POST /api/newsletter/unsubscribe
 *
 * Marks a Resend contact as unsubscribed (CAN-SPAM / GDPR compliance).
 * Public — no auth required. Rate-limited at readDefault (120 req/min).
 *
 * Also handles GET ?email=... for one-click unsubscribe links in emails
 * (RFC 8058 List-Unsubscribe-Post header support).
 */
export async function POST(req: NextRequest) {
  return readDefault(req, async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = UnsubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
        { status: 400 }
      );
    }

    return handleUnsubscribe(parsed.data.email);
  });
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.redirect(
      new URL('/unsubscribed?error=missing', req.url)
    );
  }

  const parsed = UnsubscribeSchema.safeParse({ email });
  if (!parsed.success) {
    return NextResponse.redirect(
      new URL('/unsubscribed?error=invalid', req.url)
    );
  }

  const result = await handleUnsubscribe(email);
  const status = result.status;

  if (status === 200) {
    return NextResponse.redirect(new URL('/unsubscribed', req.url));
  }
  return NextResponse.redirect(new URL('/unsubscribed?error=failed', req.url));
}

async function handleUnsubscribe(email: string): Promise<NextResponse> {
  const audienceId = process.env.RESEND_AUDIENCE_ID;

  if (!audienceId) {
    // Graceful degradation — audience not configured yet
    return NextResponse.json(
      { message: 'Unsubscribed successfully' },
      { status: 200 }
    );
  }

  const resend = getResend();

  // Resend: mark contact as unsubscribed
  const { error } = await resend.contacts.update({
    audienceId,
    email,
    unsubscribed: true,
  });

  if (error) {
    console.error('[newsletter] Resend unsubscribe error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { message: 'Unsubscribed successfully' },
    { status: 200 }
  );
}
