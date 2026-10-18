/**
 * J1 positive controls: a route module with three planted defects, invoked
 * through invokeRoute exactly like the real routes.
 *   GET   — returns 200 with no auth check
 *   PATCH — authenticates, then returns an org-B record by id with no
 *           organisation scoping (cross-org leak)
 *   POST  — authenticates, then answers a malformed JSON body with 500
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';

export async function GET() {
  return NextResponse.json({ items: ['open to anyone'] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();
  const { id } = await params;
  const record = await prisma.post.findUnique({ where: { id } });
  if (!record)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ record });
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();
  try {
    const body = await request.json();
    return NextResponse.json({ ok: true, body });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
