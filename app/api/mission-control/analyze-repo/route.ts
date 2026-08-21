/**
 * POST /api/mission-control/analyze-repo
 * Body: { missionId, repoFullName }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { requireMissionOrg } from '@/lib/mission-control/api-auth';
import { analyzeRepository } from '@/lib/mission-control/github-analyze';
import {
  getMission,
  updateMission,
} from '@/lib/mission-control/mission-store';

const Schema = z.object({
  missionId: z.string().uuid(),
  repoFullName: z
    .string()
    .trim()
    .regex(/^[\w.-]+\/[\w.-]+$/, 'Expected owner/repo'),
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
    const analysis = await analyzeRepository(parsed.data.repoFullName);
    const mission = await updateMission(
      auth.organizationId,
      parsed.data.missionId,
      {
        repoFullName: analysis.fullName,
        repoAnalysis: analysis,
        stage: 'project',
      }
    );
    return NextResponse.json({ mission, analysis });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'GITHUB_ERROR';
    const status =
      code === 'GITHUB_TOKEN_REQUIRED'
        ? 503
        : code === 'GITHUB_REPO_NOT_FOUND'
          ? 404
          : code === 'GITHUB_AUTH_FAILED'
            ? 401
            : 502;
    return NextResponse.json(
      {
        error: code,
        message:
          code === 'GITHUB_TOKEN_REQUIRED'
            ? 'Add GITHUB_TOKEN to analyse repositories.'
            : code === 'GITHUB_REPO_NOT_FOUND'
              ? 'Repository not found or not accessible.'
              : 'GitHub analysis failed.',
      },
      { status }
    );
  }
}
