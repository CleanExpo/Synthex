/**
 * @deprecated Removed — Sentry test endpoint archived 2026-03-12.
 *
 * The static `import * as Sentry from '@sentry/nextjs'` in this file caused
 * require-in-the-middle / import-in-the-middle OTel hooks to land in shared
 * webpack chunks (chunk 40767.js, 993 KB) which are loaded by EVERY Lambda on
 * cold start, hanging ALL endpoints for 10+ seconds.
 *
 * Replaced with a 404 stub so the route still compiles but emits no Sentry code.
 * Original: .claude/archived/2026-03-12/sentry-test-route.ts
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
