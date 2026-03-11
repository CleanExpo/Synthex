/**
 * PR Distribution Channels Catalogue (Phase 93)
 *
 * GET /api/pr/channels
 *
 * Returns the static DISTRIBUTION_CHANNELS registry.
 * No authentication required — public metadata endpoint.
 *
 * @module app/api/pr/channels/route
 */

import { NextResponse } from 'next/server';
import { DISTRIBUTION_CHANNELS } from '@/lib/pr/distribution-channels';

export async function GET() {
  return NextResponse.json({ channels: DISTRIBUTION_CHANNELS });
}
