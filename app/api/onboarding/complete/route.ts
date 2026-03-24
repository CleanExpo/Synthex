/**
 * Onboarding Completion API (New Flow)
 *
 * POST /api/onboarding/complete
 *
 * Called when the user finishes the new 3-step onboarding flow
 * (URL → Review → Connect). By this point:
 *   - Organisation already exists (created in /api/onboarding/review)
 *   - Pipeline data is stored in OnboardingProgress.auditData
 *   - Social platforms are OAuth-connected (or skipped)
 *
 * This endpoint:
 *   1. Marks user.onboardingComplete = true
 *   2. Creates a Persona from the AI-suggested data
 *   3. Creates BusinessOwnership record if missing
 *   4. Updates OnboardingProgress status to 'completed'
 *   5. Fires welcome email + webhook
 *   6. Generates a new JWT with onboardingComplete: true
 *
 * @module app/api/onboarding/complete/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateToken } from '@/lib/auth/jwt-utils';
import { sendWelcomeSequenceDay0 } from '@/lib/email/billing-emails';
import { seedVaultFromOnboarding } from '@/lib/vault/onboarding-seeder';
import { runLaunchPipeline } from '@/lib/autopilot/launch-pipeline';

// ============================================================================
// Validation — body is optional (endpoint is auth-gated, no required fields)
// ============================================================================

const completeOnboardingSchema = z
  .object({
    skipWelcomeEmail: z.boolean().optional(),
  })
  .strict()
  .optional();

// ============================================================================
// POST — Complete Onboarding
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    // Validate optional body (reject unexpected fields)
    const rawBody = await request.json().catch(() => ({}));
    const parsed = completeOnboardingSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        onboardingComplete: true,
        activeOrganizationId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Already completed — idempotent
    if (user.onboardingComplete) {
      return NextResponse.json({ success: true, alreadyComplete: true });
    }

    // Find the user's organisation (created during review step)
    const org = await prisma.organization.findFirst({
      where: { users: { some: { id: user.id } } },
      select: { id: true, name: true },
    });

    if (!org) {
      return NextResponse.json(
        {
          error:
            'No organisation found. Please complete the review step first.',
        },
        { status: 400 }
      );
    }

    // Load pipeline data for persona creation
    let pipelineData: Record<string, unknown> | null = null;
    try {
      const progress = await prisma.onboardingProgress.findFirst({
        where: { userId: user.id, organizationId: org.id },
        select: { auditData: true },
      });
      pipelineData = progress?.auditData as Record<string, unknown> | null;
    } catch {
      // Non-fatal — persona creation will use defaults
    }

    // Run completion in a transaction
    await prisma.$transaction(async tx => {
      // 1. Create BusinessOwnership if missing
      const existingOwnership = await tx.businessOwnership.findFirst({
        where: { ownerId: user.id, organizationId: org.id },
      });

      if (!existingOwnership) {
        await tx.businessOwnership.create({
          data: {
            ownerId: user.id,
            organizationId: org.id,
            displayName: org.name,
            isActive: true,
          },
        });
      }

      // 2. Set user's active organisation
      await tx.user.update({
        where: { id: user.id },
        data: {
          activeOrganizationId: org.id,
          isMultiBusinessOwner: true,
          onboardingComplete: true,
        },
      });

      // 3. Create persona from AI-suggested data
      const personaName =
        (pipelineData?.suggestedPersonaName as string) || `${org.name} AI`;
      const personaTone =
        (pipelineData?.suggestedTone as string) || 'professional';
      const keyTopics = (pipelineData?.keyTopics as string[]) || [];

      await tx.persona.create({
        data: {
          name: personaName,
          tone: personaTone,
          description:
            keyTopics.length > 0 ? `Topics: ${keyTopics.join(', ')}` : null,
          status: 'active',
          userId: user.id,
        },
      });

      // 3.5. Upsert BrandDNA from pipeline audit data
      const brandColours = (pipelineData?.brandColours as string[]) || [];
      const targetAudience = (pipelineData?.targetAudience as string) || '';
      const industry = (pipelineData?.industry as string) || '';
      const sourceUrl = (pipelineData?.websiteUrl as string) || '';

      const brandDnaData = {
        businessName: org.name,
        industry,
        primaryColour: brandColours[0] ?? null,
        secondaryColour: brandColours[1] ?? null,
        brandVoice: { tone: personaTone },
        persona: {
          description: targetAudience || null,
          values: keyTopics,
        },
        sourceUrl,
      };

      await tx.brandDNA.upsert({
        where: { organizationId: org.id },
        create: { organizationId: org.id, ...brandDnaData },
        update: brandDnaData,
      });

      // 4. Update OnboardingProgress
      try {
        await tx.onboardingProgress.updateMany({
          where: { userId: user.id, organizationId: org.id },
          data: {
            currentStage: 'complete',
            status: 'completed',
            completedAt: new Date(),
          },
        });
      } catch {
        // Non-fatal
      }
    });

    // Fire welcome email (fire-and-forget)
    try {
      sendWelcomeSequenceDay0(user.email, user.name ?? undefined);
    } catch {
      // Non-fatal
    }

    // Store email sequence start timestamp
    try {
      const currentPrefs = await prisma.user.findUnique({
        where: { id: user.id },
        select: { preferences: true },
      });
      const existingPrefs =
        currentPrefs?.preferences !== null &&
        typeof currentPrefs?.preferences === 'object' &&
        !Array.isArray(currentPrefs?.preferences)
          ? (currentPrefs.preferences as Record<string, unknown>)
          : {};

      await prisma.user.update({
        where: { id: user.id },
        data: {
          preferences: {
            ...existingPrefs,
            emailSequenceStartedAt: new Date().toISOString(),
          },
        },
      });
    } catch {
      // Non-fatal
    }

    // Generate updated JWT with onboardingComplete: true
    const newToken = await generateToken({
      userId: user.id,
      email: user.email,
      onboardingComplete: true,
    });

    const response = NextResponse.json({
      success: true,
      organizationId: org.id,
    });

    // Set the updated JWT cookie
    response.cookies.set('supabase-auth-token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Seed vault with credentials (non-fatal, best-effort)
    try {
      await seedVaultFromOnboarding(user.id, org.id);
    } catch (vaultErr) {
      logger.warn('[complete] Vault seeding failed (non-fatal)', {
        error: vaultErr instanceof Error ? vaultErr.message : String(vaultErr),
      });
    }

    // Launch autopilot content pipeline (fire-and-forget)
    try {
      runLaunchPipeline({ userId: user.id, organizationId: org.id }).catch(
        err => {
          logger.warn('[complete] Autopilot launch failed (non-fatal)', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      );
    } catch {
      // Non-fatal — autopilot will retry via daily cron
    }

    logger.info('[complete] Onboarding completed', {
      userId: user.id,
      orgId: org.id,
    });

    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(
      '[complete] Onboarding completion failed',
      error instanceof Error ? error : undefined,
      { message: msg }
    );
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}
