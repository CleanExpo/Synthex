// SYN-527: Generate Brand IQ Next Steps via Claude haiku
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { trackPipelineCost } from '@/lib/pipelines/track-cost';
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
const _postHandler = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json();
    const { voiceScore, resonanceScore, topAttributes, bestWindow } = body;

    const client = new Anthropic();
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

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    // Track cost
    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    const costUsd = inputTokens * 0.0000008 + outputTokens * 0.000004;

    await trackPipelineCost({
      pipeline_name: 'brand-iq-next-steps',
      client_id: userId,
      run_id: runId,
      model: 'claude-haiku-4-5',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
    });

    const rawText =
      message.content[0].type === 'text' ? message.content[0].text : '[]';
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
