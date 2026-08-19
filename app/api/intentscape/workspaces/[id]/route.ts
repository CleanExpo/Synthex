import { NextRequest } from 'next/server';
import { APISecurityChecker } from '@/lib/security/api-security-checker';
import {
  authenticateIntentScapeRequest,
  intentScapeErrorResponse,
} from '@/lib/intentscape/api';
import {
  createIntentScapeRuntime,
  IntentScapeWorkspaceIdSchema,
} from '@/lib/intentscape/runtime';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateIntentScapeRequest(request, 'read');
  if (!auth.allowed) return auth.response;
  try {
    const workspaceId = IntentScapeWorkspaceIdSchema.parse((await params).id);
    const intentscape = createIntentScapeRuntime(auth);
    const snapshot = await intentscape.getWorkspace(workspaceId);
    if (!snapshot) {
      return APISecurityChecker.createSecureResponse(
        { error: 'IntentScape resource not found' },
        404
      );
    }
    return APISecurityChecker.createSecureResponse({ snapshot });
  } catch (error) {
    return intentScapeErrorResponse(error);
  }
}
