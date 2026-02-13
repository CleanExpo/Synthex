/**
 * Visual Assets API — List user's visual assets
 *
 * GET /api/visuals?type=&reportId=&minQuality=&limit=&offset=
 * Returns: { assets: [...], total, hasMore }
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/visuals/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { listVisualAssets } from '@/lib/services/visual-asset-manager';
import type { VisualType } from '@/lib/services/paper-banana-client';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const result = await listVisualAssets({
      userId,
      type: searchParams.get('type') as VisualType | undefined,
      reportId: searchParams.get('reportId') ? parseInt(searchParams.get('reportId')!, 10) : undefined,
      minQuality: searchParams.get('minQuality') ? parseFloat(searchParams.get('minQuality')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('List visuals error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to list visuals' }, { status: 500 });
  }
}
