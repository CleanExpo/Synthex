/**
 * POST /api/learning-loop/observe — snapshot the observed outcome and the
 * rule-based recommendation for one data class. Any member of the
 * organisation may run it; it decides nothing.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withOrg } from '@/lib/auth/with-org';
import { getExperimentSpec } from '@/lib/cards/white-rabbit';
import { DATA_CLASSES } from '@/lib/learning-loop/summary';
import { observeOutcome } from '@/lib/learning-loop/store';
import { loopErrorResponse } from '../errors';

const bodySchema = z
  .object({
    experimentId: z.string().min(1).max(100),
    dataClass: z.enum(DATA_CLASSES),
  })
  .strict();

export const POST = withOrg(async (request, { userId, org }) => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const spec = getExperimentSpec(parsed.data.experimentId);
  if (!spec)
    return NextResponse.json(
      { error: 'NOT_FOUND', message: 'No experiment spec with that id.' },
      { status: 404 }
    );
  try {
    const result = await observeOutcome({
      organizationId: org.id,
      experimentId: spec.id,
      actorId: userId,
      dataClass: parsed.data.dataClass,
      spec,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return loopErrorResponse(error, 'observe');
  }
});
