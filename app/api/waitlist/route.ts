/**
 * Waitlist API Route
 *
 * Public endpoint — no authentication required.
 * Accepts an email address, stores it in the waitlist_entries table,
 * and sends a confirmation email via Resend.
 *
 * Rate limit: 5 requests per minute per IP (authStrict preset).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authStrict } from '@/lib/rate-limit';
import { sendWaitlistConfirmationEmail } from '@/lib/email/waitlist-email';

const WaitlistSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  return authStrict(req, async () => {
    // 1. Parse + validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const parsed = WaitlistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // 2. Check for duplicate
    const existing = await prisma.waitlistEntry.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      // Return success-like response — no need to reveal existence to the user
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // 3. Insert
    await prisma.waitlistEntry.create({
      data: { email },
    });

    // 4. Send confirmation email (fire-and-forget)
    sendWaitlistConfirmationEmail({ email });

    return NextResponse.json({ success: true }, { status: 201 });
  });
}
