import { NextRequest } from 'next/server';
import { APISecurityChecker } from '@/lib/security/api-security-checker';
import {
  authenticateIntentScapeRequest,
  intentScapeErrorResponse,
  parseJsonBody,
} from '@/lib/intentscape/api';
import { createIntentScapeRuntime } from '@/lib/intentscape/runtime';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await authenticateIntentScapeRequest(request, 'read');
  if (!auth.allowed) return auth.response;
  try {
    const intentscape = createIntentScapeRuntime(auth);
    const workspaces = await intentscape.listWorkspaces();
    return APISecurityChecker.createSecureResponse({ workspaces });
  } catch (error) {
    return intentScapeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateIntentScapeRequest(request, 'write');
  if (!auth.allowed) return auth.response;
  try {
    const intentscape = createIntentScapeRuntime(auth);
    const workspace = await intentscape.createWorkspace(
      await parseJsonBody(request)
    );
    return APISecurityChecker.createSecureResponse({ workspace }, 201);
  } catch (error) {
    return intentScapeErrorResponse(error);
  }
}
