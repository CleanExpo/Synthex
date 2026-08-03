import { NextRequest } from 'next/server';
import { APISecurityChecker } from '@/lib/security/api-security-checker';
import {
  authenticateIntentScapeRequest,
  intentScapeErrorResponse,
  parseJsonBody,
} from '@/lib/intentscape/api';
import {
  createIntentScapeRuntime,
  IntentScapeWorkspaceIdSchema,
} from '@/lib/intentscape/runtime';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateIntentScapeRequest(request, 'write');
  if (!auth.allowed) return auth.response;
  try {
    const workspaceId = IntentScapeWorkspaceIdSchema.parse((await params).id);
    const intentscape = createIntentScapeRuntime(auth);
    const goalContract = await intentscape.approveGoal(
      workspaceId,
      await parseJsonBody(request)
    );
    return APISecurityChecker.createSecureResponse({ goalContract });
  } catch (error) {
    return intentScapeErrorResponse(error);
  }
}
