import { NextRequest } from 'next/server';
import { APISecurityChecker } from '@/lib/security/api-security-checker';
import {
  authenticateIntentScapeRequest,
  intentScapeErrorResponse,
  withIntentScapeExpansionLimit,
} from '@/lib/intentscape/api';
import {
  createIntentScapeRuntime,
  IntentScapeWorkspaceIdSchema,
} from '@/lib/intentscape/runtime';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateIntentScapeRequest(request, 'write');
  if (!auth.allowed) return auth.response;
  return withIntentScapeExpansionLimit(request, auth.userId, async () => {
    try {
      const workspaceId = IntentScapeWorkspaceIdSchema.parse((await params).id);
      const intentscape = createIntentScapeRuntime(auth);
      const acceptedVision = await intentscape.expandVision(workspaceId);
      return APISecurityChecker.createSecureResponse({ acceptedVision });
    } catch (error) {
      return intentScapeErrorResponse(error);
    }
  });
}
