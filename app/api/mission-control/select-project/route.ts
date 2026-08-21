/**
 * POST /api/mission-control/select-project
 * Bind a Linear project to a mission (required before drafting).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { requireMissionOrg } from '@/lib/mission-control/api-auth';
import {
  getMission,
  updateMission,
} from '@/lib/mission-control/mission-store';
import { listLinearProjects } from '@/lib/mission-control/linear-projects';

const Schema = z.object({
  missionId: z.string().uuid(),
  projectId: z.string().min(1),
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

  try {
    const projects = await listLinearProjects();
    const project = projects.find(p => p.id === parsed.data.projectId);
    if (!project) {
      return NextResponse.json(
        {
          error: 'PROJECT_NOT_FOUND',
          message: 'Select an existing Linear project or create one first.',
        },
        { status: 404 }
      );
    }

    const mission = await updateMission(
      auth.organizationId,
      parsed.data.missionId,
      {
        linearProjectId: project.id,
        linearProjectName: project.name,
        stage: 'draft',
      }
    );

    return NextResponse.json({ mission, project });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'LINEAR_ERROR';
    return NextResponse.json(
      { error: msg, message: 'Could not bind Linear project.' },
      { status: 502 }
    );
  }
}
