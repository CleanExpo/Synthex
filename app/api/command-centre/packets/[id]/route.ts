/**
 * Command Centre — single command packet: inspect + lifecycle transition (SYN-1032).
 *
 * GET   /api/command-centre/packets/:id        inspect one packet (org-scoped)
 * PATCH /api/command-centre/packets/:id         drive lifecycle: approve | route |
 *                                                complete | block (+ optional evidence)
 *
 * Transitions never execute a provider — they only move durable state and append
 * evidence links. A production_blocked packet can never be approved.
 *
 * @module app/api/command-centre/packets/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import {
  getCommandPacket,
  transitionCommandPacket,
} from '@/lib/unite-command-center';

const TransitionSchema = z.object({
  action: z.enum(['approve', 'route', 'complete', 'block']),
  evidenceRef: z.string().trim().min(1).max(500).optional(),
});

async function resolveOrg(
  request: NextRequest,
  policy: (typeof DEFAULT_POLICIES)[keyof typeof DEFAULT_POLICIES]
): Promise<{ organizationId: string } | { error: NextResponse }> {
  const security = await APISecurityChecker.check(request, policy);
  if (!security.allowed) {
    return { error: NextResponse.json({ error: security.error }, { status: 401 }) };
  }
  const organizationId = await getEffectiveOrganizationId(security.context.userId!);
  if (!organizationId) {
    return {
      error: NextResponse.json({ error: 'No organisation found' }, { status: 400 }),
    };
  }
  return { organizationId };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolved = await resolveOrg(request, DEFAULT_POLICIES.AUTHENTICATED_READ);
  if ('error' in resolved) return resolved.error;

  const { id } = await params;
  const packet = await getCommandPacket(resolved.organizationId, id);
  if (!packet) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ packet });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolved = await resolveOrg(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE);
  if ('error' in resolved) return resolved.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
  }

  const parsed = TransitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;
  const result = await transitionCommandPacket(
    resolved.organizationId,
    id,
    parsed.data.action,
    parsed.data.evidenceRef
  );

  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ packet: result.packet, noop: result.noop ?? false });
}
