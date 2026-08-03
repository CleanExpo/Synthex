import { NextRequest, NextResponse } from 'next/server';
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
    const bundle = await intentscape.exportWorkspace(workspaceId);
    return new NextResponse(bundle.markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${bundle.filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      },
    });
  } catch (error) {
    return intentScapeErrorResponse(error);
  }
}
