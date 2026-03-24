/**
 * POST /api/autonomous/parse — Preview only, no side effects
 *
 * Converts a natural language instruction into a structured workflow preview.
 * Requires authenticated session + Professional+ plan.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { parseInstruction } from '@/lib/autonomous';

export const runtime = 'nodejs';

const ALLOWED_PLANS = ['professional', 'business', 'custom'];

const parseSchema = z.object({
  instruction: z
    .string()
    .min(10, 'Instruction must be at least 10 characters')
    .max(2000, 'Instruction must be under 2000 characters'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!security.allowed || !security.context.userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const subscription = await subscriptionService.getSubscription(
    security.context.userId
  );
  if (!subscription || !ALLOWED_PLANS.includes(subscription.plan)) {
    return NextResponse.json(
      {
        error: 'This feature requires a Professional or Business plan.',
        upgrade: true,
      },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validated = parseSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: validated.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const parsed = await parseInstruction(validated.data.instruction);
    return NextResponse.json({ parsed });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to parse instruction';
    console.error('[autonomous/parse] Parse error:', message);
    return NextResponse.json(
      { error: 'Failed to parse instruction' },
      { status: 422 }
    );
  }
}
