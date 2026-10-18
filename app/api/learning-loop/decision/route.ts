/**
 * POST /api/learning-loop/decision — the human decision on one
 * recommendation. Organisation owner only (withOrg role, fail-closed); the
 * rationale and the next decision that needs authority are required.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withOrg } from '@/lib/auth/with-org';
import { DECISIONS, recordDecision } from '@/lib/learning-loop/store';
import { loopErrorResponse } from '../errors';

const bodySchema = z
  .object({
    experimentId: z.string().min(1).max(100),
    recommendationEventId: z.string().min(1).max(100),
    decision: z.enum(DECISIONS),
    rationale: z.string().min(10).max(2_000),
    nextDecision: z.string().min(5).max(500),
  })
  .strict();

export const POST = withOrg(async (request, { userId, org, role }) => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json(
      {
        error: 'Invalid request',
        issues: parsed.error.issues.map(i => i.path.join('.')),
      },
      { status: 400 }
    );
  try {
    const row = await recordDecision({
      organizationId: org.id,
      actorId: userId,
      actorRole: role,
      ...parsed.data,
    });
    return NextResponse.json({ recorded: true, id: row.id }, { status: 201 });
  } catch (error) {
    return loopErrorResponse(error, 'decision');
  }
});
