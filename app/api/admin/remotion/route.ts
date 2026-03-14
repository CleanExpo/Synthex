/**
 * Remotion Compositions API (God Mode)
 *
 * GET  /api/admin/remotion — List available compositions with prop schemas
 * POST /api/admin/remotion — Trigger a render job (preview-only for now)
 *
 * Auth: verifyAdmin() — owner-only via isOwnerEmail or admin role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin/verify-admin';
import { COMPOSITION_REGISTRY } from '@/lib/remotion/Root';

export const runtime = 'nodejs';

// ── GET — List compositions ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth.isAdmin) {
    return NextResponse.json(
      { error: auth.error || 'Admin access required' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    compositions: COMPOSITION_REGISTRY.map((comp) => ({
      id: comp.id,
      name: comp.name,
      description: comp.description,
      dimensions: { width: comp.width, height: comp.height },
      fps: comp.fps,
      durationInFrames: comp.durationInFrames,
      durationSeconds: comp.durationInFrames / comp.fps,
      defaultProps: comp.defaultProps,
    })),
    renderCapabilities: {
      clientSidePreview: true,
      serverSideRender: false,
      lambdaRender: false,
      note: 'Server-side and Lambda rendering not yet configured. Use the Studio page for client-side preview.',
    },
  });
}

// ── POST — Render job (future) ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth.isAdmin) {
    return NextResponse.json(
      { error: auth.error || 'Admin access required' },
      { status: 403 }
    );
  }

  // Server-side rendering is not available on Vercel (50MB function limit,
  // 60s timeout). This endpoint is a placeholder for future Remotion Lambda
  // integration.
  return NextResponse.json(
    {
      status: 'preview-only',
      message: 'Server-side rendering is not yet configured. Use the Remotion Studio page (/dashboard/admin/remotion-studio) for client-side preview.',
      supportedActions: ['preview'],
      futureActions: ['render-mp4', 'render-gif', 'lambda-render'],
    },
    { status: 202 }
  );
}
