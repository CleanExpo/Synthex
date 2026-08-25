/**
 * GET /api/mission-control/repos — list accessible GitHub repos
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireMissionOrg } from '@/lib/mission-control/api-auth';
import { getLastRepoFullName } from '@/lib/mission-control/mission-store';
import {
  isGitHubConfigured,
  listAccessibleRepos,
} from '@/lib/mission-control/github-analyze';

export async function GET(request: NextRequest) {
  const auth = await requireMissionOrg(request);
  if (!auth.ok) return auth.response;

  if (!isGitHubConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        repos: [],
        lastRepoFullName: null,
        error: 'GITHUB_TOKEN_REQUIRED',
        message:
          'Add GITHUB_TOKEN (or GH_TOKEN) to the server environment to analyse repositories.',
      },
      { status: 200 }
    );
  }

  try {
    const [repos, lastRepoFullName] = await Promise.all([
      listAccessibleRepos(40),
      getLastRepoFullName(auth.organizationId),
    ]);
    return NextResponse.json({
      configured: true,
      repos,
      lastRepoFullName,
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'GITHUB_ERROR';
    return NextResponse.json(
      {
        configured: true,
        repos: [],
        lastRepoFullName: null,
        error: code,
        message:
          code === 'GITHUB_AUTH_FAILED'
            ? 'GitHub authentication failed. Reconnect or rotate GITHUB_TOKEN.'
            : 'Failed to list repositories.',
      },
      { status: 502 }
    );
  }
}
