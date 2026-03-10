/**
 * Authority Sources API — Retrieve Source Connector Status
 *
 * GET /api/authority/sources
 * Returns: Array of connector status objects
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/authority/sources/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { getConnectorStatus } from '@/lib/authority/source-connectors/index';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const connectors = getConnectorStatus();

    return NextResponse.json(connectors);
  } catch (error) {
    logger.error('Authority sources fetch error', error);
    return NextResponse.json({ error: 'Failed to fetch source connector status' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
