/**
 * GBP Auto-Reply Suggestion API
 *
 * POST — Generate AI reply suggestion for a review (stored, never auto-sent)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { getAIProvider } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';

// ── Types ────────────────────────────────────────────────────────────────────

interface BrandVoice {
  formality?: number; // 1-5 (1 = casual, 5 = formal)
  boldness?: number; // 1-5
  tone?: string;
  samplePhrases?: string[];
}

// ── Validation ───────────────────────────────────────────────────────────────

const autoReplyBodySchema = z
  .object({
    tone: z
      .enum(['warm', 'professional', 'empathetic', 'constructive'])
      .optional(),
    maxWords: z.number().int().min(20).max(500).optional(),
  })
  .strict()
  .optional();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;

  // Validate optional body (reject unexpected fields)
  const rawBody = await request.json().catch(() => ({}));
  const parsed = autoReplyBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const organizationId = await getEffectiveOrganizationId(userId);
  const { reviewId } = await params;

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  try {
    const review = await prisma.gBPReview.findFirst({
      where: { id: reviewId, organizationId },
      include: { location: { select: { locationName: true } } },
    });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Get org context + brand voice for tone-matched response
    const [org, brandDna] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, industry: true },
      }),
      prisma.brandDNA.findUnique({
        where: { organizationId },
        select: { brandVoice: true, businessName: true, vertical: true },
      }),
    ]);

    // Generate AI suggestion
    const prompt = buildReplyPrompt(
      review.rating,
      review.comment,
      review.reviewerName,
      review.location.locationName,
      org?.name,
      org?.industry,
      brandDna?.brandVoice as BrandVoice | null
    );

    let suggestion = '';

    try {
      const ai = getAIProvider();
      const aiResult = await ai.complete({
        model: ai.models.fast,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 350,
      });
      suggestion = (aiResult.choices[0]?.message.content ?? '').trim();
    } catch (aiErr) {
      logger.warn('GBP auto-reply: AI generation failed, using fallback', {
        error: aiErr instanceof Error ? aiErr.message : String(aiErr),
      });
      suggestion = buildFallbackReply(review.rating, review.reviewerName);
    }

    // Store suggestion — NEVER auto-send (human approval gate)
    await prisma.gBPReview.update({
      where: { id: reviewId },
      data: {
        aiSuggestion: suggestion,
        aiSuggestionAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      suggestion,
      message: 'AI suggestion generated. Review and approve before sending.',
    });
  } catch (error) {
    logger.error('GBP auto-reply error:', error);
    return NextResponse.json(
      { error: 'Failed to generate reply suggestion' },
      { status: 500 }
    );
  }
}

function buildReplyPrompt(
  rating: number,
  comment: string | null,
  reviewerName: string | null,
  locationName: string,
  orgName?: string | null,
  industry?: string | null,
  brandVoice?: BrandVoice | null
): string {
  const name = reviewerName ? reviewerName.split(' ')[0] : null;

  // Sentiment-appropriate instruction
  let sentimentInstruction: string;
  if (rating >= 5) {
    sentimentInstruction =
      'Warm appreciation + reference something specific from the review if possible. Invite them to return.';
  } else if (rating === 4) {
    sentimentInstruction =
      'Express genuine gratitude. Invite them to connect further or return.';
  } else if (rating === 3) {
    sentimentInstruction =
      "Acknowledge their experience. Say you'd love to learn more. Provide a direct contact CTA.";
  } else {
    sentimentInstruction =
      'Show empathy. Frame the response around resolution, not defence. Invite them to contact you offline to resolve the issue.';
  }

  // Brand voice context (only if available)
  let voiceContext = '';
  if (brandVoice) {
    const formalityLevel =
      (brandVoice.formality ?? 3) >= 4
        ? 'formal and professional'
        : (brandVoice.formality ?? 3) <= 2
          ? 'conversational and relaxed'
          : 'warm and professional';
    voiceContext = `\nBrand voice: ${formalityLevel}${brandVoice.tone ? `, ${brandVoice.tone}` : ''}.`;
    if (brandVoice.samplePhrases?.length) {
      voiceContext += ` Match this register (sample phrases: "${brandVoice.samplePhrases.slice(0, 2).join('", "')}").`;
    }
  }

  return `You are writing a Google Business Profile reply on behalf of a business owner.

Business: ${orgName || locationName}${industry ? ` (${industry})` : ''}${voiceContext}
Reviewer: ${name ?? 'a customer'}
Rating: ${rating}/5 stars
Review: ${comment || '(no text provided — just a star rating)'}

Instructions:
- ${sentimentInstruction}
- Keep it under 180 words
- Sound like a real person, not a corporate template
- Do NOT start with "Thank you for your feedback", "We appreciate your review", or "We take all feedback seriously"
- Do NOT use emojis or include a signature
- Use Australian English spelling (recognise, colour, organise, etc.)
- Address the reviewer by first name if provided

Reply (write only the reply text, nothing else):`;
}

function buildFallbackReply(
  rating: number,
  reviewerName: string | null
): string {
  const name = reviewerName ? `${reviewerName}, t` : 'T';

  if (rating >= 4) {
    return `${name}hank you for your kind review! We truly appreciate your feedback and are glad we could deliver a great experience. We look forward to serving you again.`;
  }

  if (rating >= 3) {
    return `${name}hank you for taking the time to share your experience. We appreciate your feedback and are always looking for ways to improve. Please don't hesitate to reach out to us directly so we can make things right.`;
  }

  return `${name}hank you for your feedback. We're sorry to hear about your experience and take your concerns seriously. We'd love the opportunity to make it right — please contact us directly so we can address this personally.`;
}
