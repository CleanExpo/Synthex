import { NextResponse } from 'next/server';

/**
 * GET /api/nexus/status
 *
 * Stub — returns Unite-Group Nexus connection metadata.
 * Replace with real Nexus API call when NEXUS_API_URL env var is set.
 */
export async function GET() {
  return NextResponse.json({
    connected: true,
    businesses: 6,
    last_sync: new Date().toISOString(),
    ccw_sync: true,
  });
}
