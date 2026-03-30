// SYN-527: Generate Brand IQ Next Steps via Claude haiku
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { trackPipelineCost } from '@/lib/pipelines/track-cost';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, voiceScore, resonanceScore, topAttributes, bestWindow } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

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
    await trackPipelineCost({
      pipelineName: 'brand-iq-next-steps',
      clientId: userId,
      runId,
      model: 'claude-haiku-4-5',
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '[]';
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
        'Review last week\'s top post and replicate its format.',
      ];
    }

    return NextResponse.json({ nextSteps });
  } catch (err) {
    console.error('brand-iq next-steps error:', err);
    return NextResponse.json({ error: 'Failed to generate next steps' }, { status: 500 });
  }
}
