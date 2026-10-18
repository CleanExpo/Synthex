/**
 * GET /api/learning-loop?experimentId=… — the whole loop for one experiment in
 * the caller's active organisation (withOrg, fail-closed). Read-only.
 */
import { NextResponse } from 'next/server';
import { withOrg } from '@/lib/auth/with-org';
import { loadLoop } from '@/lib/learning-loop/store';
import { loopErrorResponse } from './errors';

export const GET = withOrg(async (request, { org, role }) => {
  const experimentId = request.nextUrl.searchParams.get('experimentId');
  if (!experimentId || experimentId.length > 100) {
    return NextResponse.json(
      { error: 'experimentId is required' },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json({
      ...(await loadLoop(org.id, experimentId)),
      viewerRole: role,
    });
  } catch (error) {
    return loopErrorResponse(error, 'load');
  }
});
