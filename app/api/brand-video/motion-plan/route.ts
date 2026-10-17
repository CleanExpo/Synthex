/**
 * POST /api/brand-video/motion-plan
 *
 * Motion Studio (Claude-Motion-style motion graphics) — plan only. Turns a
 * brief into a fact-checked, brand-styled Remotion composition plan plus a
 * Claude Motion hand-off brief. Spends nothing, renders nothing, writes nothing:
 * rendering stays the local/operator step until a render substrate is approved.
 *
 * Auth: withAuth. Rate-limited. Zod-validated. Brand preflight as for
 * /api/brand-video/generate, so an unknown or unapproved brand is refused.
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { withRateLimit } from '@/lib/rate-limit';
import { preflightBrandAssets } from '@/lib/brand-video/preflight';
import {
  MotionBriefSchema,
  buildClaudeMotionBrief,
  planMotion,
  resolveHouseStyle,
} from '@/lib/motion';

export const runtime = 'nodejs';

export const POST = withAuth(async request =>
  withRateLimit(request, async () => {
    const body = await request.json().catch(() => null);
    const parsed = MotionBriefSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const preflight = preflightBrandAssets(parsed.data.brand);
    if (!preflight.ok || !preflight.slug) {
      return NextResponse.json(
        {
          error: 'Brand preflight failed',
          details: preflight.findings.map(f => f.message),
        },
        { status: 400 }
      );
    }

    const style = resolveHouseStyle(preflight.slug);
    const plan = planMotion(parsed.data, style);

    if (plan.issues.length > 0) {
      return NextResponse.json(
        {
          state: plan.factCheck.ok ? 'PARTIAL' : 'UNSUPPORTED',
          error: 'The brief cannot be rendered as written',
          issues: plan.issues,
          factCheck: plan.factCheck,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      plan,
      houseStyle: style,
      claudeMotionBrief: buildClaudeMotionBrief(parsed.data, style, plan),
      warnings: [...plan.warnings, ...preflight.warnings.map(w => w.message)],
      next: 'Render locally with the motion-studio skill (Remotion), critique one still per second, then a human approves before export.',
    });
  })
);
