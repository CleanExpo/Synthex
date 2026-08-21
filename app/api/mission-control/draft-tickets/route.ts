/**
 * POST /api/mission-control/draft-tickets
 * Requires selected Linear project. Never creates Linear issues.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { requireMissionOrg } from '@/lib/mission-control/api-auth';
import { draftTicketsFromGoal } from '@/lib/mission-control/draft-tickets';
import {
  getMission,
  updateMission,
} from '@/lib/mission-control/mission-store';

const Schema = z.object({
  missionId: z.string().uuid(),
});

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

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await getMission(
    auth.organizationId,
    parsed.data.missionId
  );
  if (!existing) {
    return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
  }

  if (!existing.linearProjectId || !existing.linearProjectName) {
    return NextResponse.json(
      {
        error: 'PROJECT_REQUIRED',
        message:
          'Select or create a Linear project before drafting tickets. Drafting is blocked without a project.',
      },
      { status: 400 }
    );
  }

  const { tickets, source } = await draftTicketsFromGoal({
    goal: existing.goal,
    acceptanceCriteria: existing.acceptanceCriteria,
    projectName: existing.linearProjectName,
    repo: existing.repoAnalysis,
  });

  const mission = await updateMission(
    auth.organizationId,
    parsed.data.missionId,
    {
      draftTickets: tickets,
      stage: 'approval',
    }
  );

  return NextResponse.json({ mission, source });
}
