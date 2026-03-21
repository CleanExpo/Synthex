/**
 * GBP Auto-Reply Suggestion API
 *
 * POST — Generate AI reply suggestion for a review (stored, never auto-sent)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { logger } from '@/lib/logger';

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

    // Get org context for tone
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, industry: true },
    });

    // Generate AI suggestion
    const prompt = buildReplyPrompt(
      review.rating,
      review.comment,
      review.reviewerName,
      review.location.locationName,
      org?.name,
      org?.industry
    );

    // Use internal AI — call the content generation endpoint
    const aiResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          maxTokens: 300,
          temperature: 0.7,
        }),
      }
    );

    let suggestion = '';

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      suggestion = aiData.content || aiData.text || '';
    } else {
      // Fallback template
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
  industry?: string | null
): string {
  const tone =
    rating >= 4
      ? 'warm and grateful'
      : rating >= 3
        ? 'appreciative and constructive'
        : 'empathetic and professional';
  const name = reviewerName || 'the customer';

  return `Write a ${tone} business reply to this Google Business Profile review.

Business: ${orgName || locationName}${industry ? ` (${industry})` : ''}
Reviewer: ${name}
Rating: ${rating}/5 stars
Review: ${comment || '(no text — just a star rating)'}

Guidelines:
- Keep it under 200 words
- Be genuine, not generic
- ${rating <= 3 ? 'Acknowledge the issue, apologise where appropriate, and invite them to reach out privately' : 'Thank them specifically for what they mentioned'}
- Use Australian English spelling (recognise, colour, etc.)
- Do NOT use emojis
- Do NOT include any signature line

Reply:`;
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
