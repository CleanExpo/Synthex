import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { ProposalError, type ProposalContext } from './service';

export async function resolveProposalContext(
  request: NextRequest,
  write = false
): Promise<ProposalContext | NextResponse> {
  const security = await APISecurityChecker.check(
    request,
    write
      ? DEFAULT_POLICIES.AUTHENTICATED_WRITE
      : DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed || !security.context.userId)
    return NextResponse.json(
      { error: security.error || 'Authentication required' },
      {
        status:
          security.error && security.error !== 'Authentication required'
            ? 403
            : 401,
      }
    );
  const organizationId = await getEffectiveOrganizationId(
    security.context.userId
  );
  if (!organizationId)
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  return { organizationId, userId: security.context.userId };
}
export async function proposalResponse(
  operation: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: 'Validation failed', details: error.flatten() },
        { status: 400 }
      );
    if (error instanceof SyntaxError)
      return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
    if (error instanceof ProposalError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    return NextResponse.json(
      { error: 'Unable to process opportunity proposal' },
      { status: 500 }
    );
  }
}

export async function readProposalBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new SyntaxError('Malformed JSON');
  }
}
