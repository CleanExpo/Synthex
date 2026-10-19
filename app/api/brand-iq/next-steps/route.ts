// SYN-527: Generate Brand IQ Next Steps via Claude haiku
import { NextRequest, NextResponse } from 'next/server';
import { AnthropicProvider } from '@/lib/ai/providers/anthropic-provider';
import { governedCall, GOVERNOR_MODE } from '@/lib/ai/governor';
import {
  estimateTextTokens,
  governedRouteResult,
  governorRefusalResponse,
  resolveOrgBrandSlug,
} from '@/lib/ai/governor-route-support';
import { withAuth } from '@/lib/auth/with-auth';
import { withRateLimit } from '@/lib/rate-limit/rate-limiter';

// Auth-wrapped: previous unauthenticated POST allowed any caller to burn
// Anthropic API credits and write arbitrary cost-ledger rows under any
// userId. The wrapped handler now uses the verified userId from the auth
// context — the body's userId field is ignored.
//
// RA-3024 — additionally gated by withRateLimit so a compromised
// authenticated session cannot issue unbounded Claude-Haiku calls. The
// rate limiter is tier-aware (resolveVerifiedTier) so paid tiers get
// higher caps.
const _postHandler = withAuth(async (req, { clientId: organizationId }) => {
  try {
    const body = await req.json();
    const { voiceScore, resonanceScore, topAttributes, bestWindow } = body;

    const client = new AnthropicProvider();
    const runId = crypto.randomUUID();

    const prompt = `You are a concise marketing coach. Given the following brand intelligence data for a small business owner, generate exactly 3 specific, actionable next steps they can take this week to improve their content performance.

Brand data:
- Voice consistency score: ${voiceScore}/100
- Audience resonance score: ${resonanceScore}/100  
- Top content attributes: ${topAttributes?.join(', ')}
- Best posting window: ${bestWindow}

Rules:
- Each step must be 1 sentence, under 20 words
- Be specific (not generic like "post more content")
- Reference their actual data where relevant
- Output as JSON array of 3 strings only, no other text

Example format: ["Step one here.", "Step two here.", "Step three here."]`;

    const MODEL = 'claude-haiku-4-5-20251001';
    const MAX_TOKENS = 200;
    // Spend gate (M10): the Governor writes the single cost-ledger receipt for
    // this call. The organisation is the verified auth org, never the body.
    const call = governedRouteResult(async ctx => {
      const provider = ctx.apiKey ? new AnthropicProvider(ctx.apiKey) : client;
      const data = await provider.complete({
        model: ctx.model?.id ?? MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      });
      return {
        data,
        modelId: data.model || undefined,
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      };
    });
    const message = call.unwrap(
      await governedCall({
        organizationId,
        brandSlug: await resolveOrgBrandSlug(organizationId),
        runner: 'brand-iq-next-steps',
        provider: 'anthropic',
        model: { kind: 'registered', modelId: MODEL },
        pipelineName: 'brand-iq-next-steps',
        runId,
        estimate: estimateTextTokens(prompt.length, MAX_TOKENS),
        mode: GOVERNOR_MODE,
        execute: call.execute,
      })
    );

    const rawText = message.choices[0]?.message?.content || '[]';
    let nextSteps: string[] = [];

    try {
      nextSteps = JSON.parse(rawText);
      if (!Array.isArray(nextSteps)) nextSteps = [];
      nextSteps = nextSteps.slice(0, 3); // Enforce max 3
    } catch {
      // Fallback if Claude returns malformed JSON
      nextSteps = [
        'Schedule posts during your best window to maximise reach.',
        'Maintain your top content attributes in every caption.',
        "Review last week's top post and replicate its format.",
      ];
    }

    return NextResponse.json({ nextSteps });
  } catch (err) {
    const refusal = governorRefusalResponse(err);
    if (refusal) return refusal;
    console.error('brand-iq next-steps error:', err);
    return NextResponse.json(
      { error: 'Failed to generate next steps' },
      { status: 500 }
    );
  }
});

export async function POST(req: NextRequest) {
  return withRateLimit(req, async () => _postHandler(req));
}
