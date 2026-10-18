/**
 * POST /api/internal/build-knowledge-graph
 *
 * Internal endpoint called nightly by the Supabase Edge Function
 * `build-client-knowledge-graph` (02:00 UTC = 12:00 AEDT).
 *
 * NOT PROVISIONED: `client_knowledge_entities` and `client_knowledge_edges`
 * have no Prisma model, so buildKnowledgeGraphForClient() always throws
 * KnowledgeGraphNotProvisionedError. After auth the route returns 503
 * FEATURE_NOT_PROVISIONED rather than a successful run that built nothing.
 *
 * Auth: Bearer CRON_SECRET
 * @task SYN-649
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { notProvisionedResponse } from '@/lib/api/not-provisioned';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = verifyCronRequest(request, 'BUILD_KNOWLEDGE_GRAPH');
  if (!auth.ok) return auth.response;

  return notProvisionedResponse(
    'Knowledge graph build is not provisioned: the client_knowledge_entities and client_knowledge_edges tables have no data model. Nothing was built.'
  );
}
