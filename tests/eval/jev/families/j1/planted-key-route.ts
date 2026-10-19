/**
 * J1 machine-key positive controls: planted defects in how a route treats a
 * `Bearer smk_…` key, invoked directly (no proxy) through the same detectors.
 *   GET   — authenticates the key, never checks its scopes (scope bypass)
 *   PATCH — authenticates the key, then takes the organisation from the
 *           x-organization-id request header instead of the key row
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lookupMachineKey, machineKeyOf } from '@/lib/auth/agent-principal';

async function keyOrNull(request: NextRequest) {
  const raw = machineKeyOf(request);
  if (!raw) return null;
  const found = await lookupMachineKey(raw);
  return found.ok ? found.key : null;
}

export async function GET(request: NextRequest) {
  // PLANTED DEFECT: any live key reaches the handler, whatever its scopes.
  if (!(await keyOrNull(request)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const key = await keyOrNull(request);
  if (!key)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // PLANTED DEFECT: organisation from the request, not the key row.
  const organizationId =
    request.headers.get('x-organization-id') ?? key.organizationId;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  return NextResponse.json({ org });
}
