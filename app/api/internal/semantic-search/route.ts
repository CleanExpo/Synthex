import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import {
  semanticSearchInputSchema,
  semanticSearchTool,
} from '@/lib/agents/tool-registry';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'SEMANTIC_SEARCH');
  if (!auth.ok) return auth.response;

  try {
    const payload = semanticSearchInputSchema.parse(await request.json());
    const results = await semanticSearchTool.execute(payload);

    logger.info('[semantic-search] query complete', {
      clientId: payload.clientId,
      resultCount: results.length,
    });

    return NextResponse.json({
      ok: true,
      tool: semanticSearchTool.name,
      resultCount: results.length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    logger.warn('[semantic-search] query failed', { message });
    return NextResponse.json(
      { ok: false, error: 'semantic_search_failed', message },
      { status: 400 }
    );
  }
}
