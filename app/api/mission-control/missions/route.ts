/**
 * GET  /api/mission-control/missions — list missions
 * POST /api/mission-control/missions — create mission from goal
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { requireMissionOrg } from '@/lib/mission-control/api-auth';
import {
  createMission,
  listMissions,
} from '@/lib/mission-control/mission-store';

const CreateSchema = z.object({
  goal: z.string().trim().min(8).max(4000),
  acceptanceCriteria: z.string().trim().max(8000).default(''),
});

export async function GET(request: NextRequest) {
  const auth = await requireMissionOrg(request);
  if (!auth.ok) return auth.response;

  const missions = await listMissions(auth.organizationId);
  return NextResponse.json({ missions });
}

export async function POST(request: NextRequest) {
  const auth = await requireMissionOrg(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const mission = await createMission({
    organizationId: auth.organizationId,
    goal: parsed.data.goal,
    acceptanceCriteria: parsed.data.acceptanceCriteria,
  });

  return NextResponse.json({ mission }, { status: 201 });
}
