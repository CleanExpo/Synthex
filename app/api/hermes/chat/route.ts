import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/hermes/chat
 *
 * Stub — echoes a placeholder reply from Margot.
 * Wire to the real Hermes agent when HERMES_API_URL is configured.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const message: string = body?.message ?? '';

  if (!message.trim()) {
    return NextResponse.json({ error: 'No message provided' }, { status: 400 });
  }

  // Placeholder response — replace with real Hermes call
  return NextResponse.json({
    reply: `Margot received: "${message}". The Hermes integration will be wired once HERMES_API_URL is configured.`,
  });
}
