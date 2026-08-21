/**
 * GET  /api/mission-control/projects — list Linear projects
 * POST /api/mission-control/projects — create Linear project
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { requireMissionOrg } from '@/lib/mission-control/api-auth';
import {
  createLinearProject,
  isLinearConfigured,
  listLinearProjects,
} from '@/lib/mission-control/linear-projects';

const CreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireMissionOrg(request);
  if (!auth.ok) return auth.response;

  if (!isLinearConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        projects: [],
        error: 'LINEAR_API_KEY_REQUIRED',
        message:
          'Add LINEAR_API_KEY to connect Linear. Ticket drafting stays blocked until then.',
      },
      { status: 200 }
    );
  }

  try {
    const projects = await listLinearProjects();
    return NextResponse.json({ configured: true, projects });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'LINEAR_ERROR';
    return NextResponse.json(
      {
        configured: true,
        projects: [],
        error: msg,
        message: 'Failed to list Linear projects.',
      },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireMissionOrg(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!auth.ok) return auth.response;

  if (!isLinearConfigured()) {
    return NextResponse.json(
      {
        error: 'LINEAR_API_KEY_REQUIRED',
        message: 'Add LINEAR_API_KEY before creating a project.',
      },
      { status: 503 }
    );
  }

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

  try {
    const project = await createLinearProject(parsed.data);
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'LINEAR_ERROR';
    return NextResponse.json(
      { error: msg, message: 'Failed to create Linear project.' },
      { status: 502 }
    );
  }
}
