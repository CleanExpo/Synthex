import { NextResponse } from 'next/server';
import { buildConnectionStatusManifest } from '@/lib/connections/status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const response = NextResponse.json(buildConnectionStatusManifest());
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
