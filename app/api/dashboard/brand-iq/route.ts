/**
 * Brand IQ Score Card API
 *
 * GET /api/dashboard/brand-iq
 *
 * Returns the Brand IQ payload for the current org:
 *   - locked: true/false (based on Organization.firstWinDetected)
 *   - brandScore: 0–100 overall brand strength
 *   - voiceConsistency: 0–100 (derived from BrandDNA.brandVoice)
 *   - audienceResonance: 0–100 (average TrendInsight confidence)
 *   - brandDna: subset of BrandDNA fields needed by the card UI
 *   - insights: top-5 TrendInsights by confidence
 *   - nextSteps: [] unless ?nextSteps=true AND org is unlocked AND BrandDNA exists
 *
 * Query params:
 *   ?nextSteps=true   — triggers Claude haiku call (tracked via SYN-518)
 *
 * @task SYN-527
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { generateNextSteps } from '@/lib/brandiq/generateNextSteps';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BrandVoice {
  formality?: number; // 1–5
  boldness?: number; // 1–5
  tone?: string;
  samplePhrases?: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert BrandDNA.brandVoice JSON into a 0–100 consistency score.
 * Requires both formality + boldness to be set (1–5).
 * Scales to 0–100: average of the two attributes × 20.
 */
function computeVoiceConsistency(brandVoice: unknown): number {
  if (!brandVoice || typeof brandVoice !== 'object') return 0;
  const voice = brandVoice as BrandVoice;
  const formality = voice.formality ?? 0;
  const boldness = voice.boldness ?? 0;
  if (formality < 1 || boldness < 1) return 0;
  // Average of 1–5 values → 0–100
  return Math.round(((formality + boldness) / 2) * 20);
}

/**
 * Average TrendInsight confidence (0.0–1.0) → 0–100 score.
 */
function computeAudienceResonance(
  insights: Array<{ confidence: number }>
): number {
  if (insights.length === 0) return 0;
  const avg =
    insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length;
  return Math.round(avg * 100);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Resolve user → org
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: 'No organisation found' },
        { status: 403 }
      );
    }

    const organizationId = user.organizationId;

    // Fetch org win state, BrandDNA, and top TrendInsights in parallel
    const [org, brandDna, insights] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { firstWinDetected: true },
      }),
      prisma.brandDNA.findUnique({
        where: { organizationId },
        select: {
          businessName: true,
          industry: true,
          vertical: true,
          brandVoice: true,
          persona: true,
          seoScore: true,
        },
      }),
      prisma.trendInsight.findMany({
        where: { organizationId },
        orderBy: { confidence: 'desc' },
        take: 5,
        select: {
          id: true,
          platform: true,
          category: true,
          insight: true,
          confidence: true,
          dataPoints: true,
        },
      }),
    ]);

    if (!org) {
      return NextResponse.json(
        { error: 'Organisation not found' },
        { status: 404 }
      );
    }

    const locked = !org.firstWinDetected;

    // Compute scores
    const voiceConsistency = brandDna
      ? computeVoiceConsistency(brandDna.brandVoice)
      : 0;
    const audienceResonance = computeAudienceResonance(insights);
    const brandScore =
      voiceConsistency > 0 || audienceResonance > 0
        ? Math.round((voiceConsistency + audienceResonance) / 2)
        : 0;

    // Optional: generate next steps (AI call — only when explicitly requested)
    const { searchParams } = new URL(request.url);
    const wantsNextSteps = searchParams.get('nextSteps') === 'true';
    let nextSteps: Array<{ action: string; reason: string }> = [];

    if (wantsNextSteps && !locked && brandDna) {
      try {
        const brandVoice = brandDna.brandVoice as BrandVoice;
        nextSteps = await generateNextSteps(
          {
            businessName: brandDna.businessName,
            industry: brandDna.industry,
            vertical: brandDna.vertical,
            tone: brandVoice.tone ?? 'professional',
          },
          organizationId
        );
      } catch (err) {
        // Non-fatal — card still renders without next steps
        logger.error('brand-iq:route: generateNextSteps failed', {
          error: err,
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          locked,
          brandScore,
          voiceConsistency,
          audienceResonance,
          brandDna: brandDna
            ? {
                businessName: brandDna.businessName,
                industry: brandDna.industry,
                vertical: brandDna.vertical,
                tone: (brandDna.brandVoice as BrandVoice)?.tone ?? null,
                formality:
                  (brandDna.brandVoice as BrandVoice)?.formality ?? null,
                boldness: (brandDna.brandVoice as BrandVoice)?.boldness ?? null,
                seoScore: brandDna.seoScore ?? null,
              }
            : null,
          insights,
          nextSteps,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=120, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    logger.error('brand-iq:route: unexpected error', { error });
    return NextResponse.json(
      { error: 'Failed to load Brand IQ data' },
      { status: 500 }
    );
  }
}

// Prisma requires Node.js runtime
export const runtime = 'nodejs';
