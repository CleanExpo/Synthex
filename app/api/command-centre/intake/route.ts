/**
 * Command Centre — Draft Intake API
 *
 * POST /api/command-centre/intake
 * Normalises founder, Board, client, Obsidian, and adapter inputs into a
 * draft-only command packet. Phase 2 does not persist or execute providers.
 *
 * @module app/api/command-centre/intake/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import {
  BoardInputSourceSchema,
  createBoardInputDraft,
} from '@/lib/unite-command-center';

const IntakeRequestSchema = z.object({
  source: BoardInputSourceSchema,
  speaker: z.string().trim().min(1).max(120),
  rawText: z.string().trim().min(1).max(12_000),
  evidenceRefs: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
});

export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Malformed JSON',
        details: error instanceof Error ? error.message : 'Invalid JSON body',
      },
      { status: 400 }
    );
  }

  const parsed = IntakeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = createBoardInputDraft({
    organizationId,
    ...parsed.data,
  });

  return NextResponse.json({
    mode: 'draft',
    persisted: false,
    executionBlocked: true,
    boardInput: result.boardInput,
    commandPacket: result.commandPacket,
  });
}
