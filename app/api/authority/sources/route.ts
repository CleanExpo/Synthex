/**
 * Authority Sources API — Retrieve Source Connector Status
 *
 * GET /api/authority/sources
 * Returns: { connectors: ConnectorStatus[] }
 *
 * The dashboard (app/dashboard/authority/page.tsx) reads `data.connectors`, so
 * the payload MUST be wrapped in a `connectors` key — a raw array silently
 * rendered as an empty connector state even on a 200 (SYN-1039).
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/authority/sources/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getConnectorStatus } from '@/lib/authority/source-connectors/index';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const connectors = getConnectorStatus();

    return NextResponse.json({ connectors });
  } catch (error) {
    logger.error('Authority sources fetch error', error);
    return NextResponse.json(
      { error: 'Failed to fetch source connector status' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
