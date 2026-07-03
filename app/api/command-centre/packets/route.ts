/**
 * Command Centre — Command Packets list API (SYN-1032).
 *
 * GET /api/command-centre/packets
 * Lists the calling organisation's durable command packets, newest first, so the
 * Command Centre and background workers can see persisted work items.
 *
 * @module app/api/command-centre/packets/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { listCommandPackets } from '@/lib/unite-command-center';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
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

  const packets = await listCommandPackets(organizationId);
  return NextResponse.json({ items: packets, total: packets.length });
}
