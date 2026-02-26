/**
 * Onboarding API Route
 *
 * @description Handles saving onboarding data and creating resources.
 * Creates Organization, BusinessOwnership, Persona, and marks onboarding complete.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies, generateToken } from '@/lib/auth/jwt-utils';
import { webhookHandler } from '@/lib/webhooks';
import { logger } from '@/lib/logger';

// ============================================================================
// VALIDATION
// ============================================================================

const onboardingSchema = z.object({
  // Step 1: Business identity
  organizationName: z.string().min(1),
  website: z.string().url().optional().or(z.literal('')),

  // Step 2: Reviewed business details
  industry: z.string().min(1),
  teamSize: z.string().min(1),
  description: z.string().optional().default(''),
  brandColors: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
  }).optional(),
  socialHandles: z.record(z.string()).optional(),
  aiGeneratedData: z.any().optional(),

  // Step 3: Platforms
  connectedPlatforms: z.array(z.string()).optional().default([]),

  // Step 4: Persona
  personaName: z.string().optional().default(''),
  personaTone: z.string().optional().default(''),
  personaTopics: z.array(z.string()).optional().default([]),
  skipPersona: z.boolean().optional().default(false),
});

// ============================================================================
// HELPERS
// ============================================================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'org';
}

async function generateUniqueSlug(baseName: string): Promise<string> {
  const baseSlug = generateSlug(baseName);
  let slug = baseSlug;
  let attempt = 0;

  while (attempt < 10) {
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (!existing) return slug;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  // Fallback: append random suffix
  return `${baseSlug}-${Date.now().toString(36)}`;
}

// ============================================================================
// POST — Save Onboarding Data
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Verify authentication via JWT
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user details for token generation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const rawBody = await request.json();
    const validation = onboardingSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const data = validation.data;

    // Generate unique slug for organization
    const slug = await generateUniqueSlug(data.organizationName);

    // Create or update organization via Prisma (type-safe with new fields)
    let organization;
    try {
      // Check if user already has an org (re-doing onboarding)
      const existingOrg = await prisma.organization.findFirst({
        where: { users: { some: { id: user.id } } },
      });

      if (existingOrg) {
        organization = await prisma.organization.update({
          where: { id: existingOrg.id },
          data: {
            name: data.organizationName,
            website: data.website || null,
            industry: data.industry,
            teamSize: data.teamSize,
            description: data.description || null,
            primaryColor: data.brandColors?.primary || null,
            socialHandles: data.socialHandles || undefined,
            aiGeneratedData: data.aiGeneratedData || undefined,
          },
        });
      } else {
        organization = await prisma.organization.create({
          data: {
            name: data.organizationName,
            slug,
            website: data.website || null,
            industry: data.industry,
            teamSize: data.teamSize,
            description: data.description || null,
            primaryColor: data.brandColors?.primary || null,
            socialHandles: data.socialHandles || undefined,
            aiGeneratedData: data.aiGeneratedData || undefined,
            users: { connect: { id: user.id } },
          },
        });

        // Create BusinessOwnership record for multi-business support
        try {
          await prisma.businessOwnership.create({
            data: {
              ownerId: user.id,
              organizationId: organization.id,
              displayName: data.organizationName,
              isActive: true,
            },
          });
        } catch (ownershipError) {
          // Non-fatal — might already exist from a previous attempt
          logger.warn('BusinessOwnership creation skipped', {
            error: String(ownershipError),
          });
        }

        // Set user's active organization and multi-business flag
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              activeOrganizationId: organization.id,
              isMultiBusinessOwner: true,
            },
          });
        } catch (userUpdateError) {
          logger.warn('User update for multi-business skipped', {
            error: String(userUpdateError),
          });
        }
      }
    } catch (orgError) {
      logger.error('Failed to create organization', { error: String(orgError) });
      return NextResponse.json(
        { error: 'Failed to create organization' },
        { status: 500 }
      );
    }

    // Create persona if not skipped
    let persona = null;
    if (!data.skipPersona && data.personaName && data.personaTone) {
      try {
        persona = await prisma.persona.create({
          data: {
            name: data.personaName,
            tone: data.personaTone,
            description: data.personaTopics?.length
              ? `Topics: ${data.personaTopics.join(', ')}`
              : null,
            status: 'active',
            userId: user.id,
          },
        });
      } catch (personaError) {
        logger.warn('Failed to create persona', { error: String(personaError) });
      }
    }

    // Mark onboarding complete in Prisma User model
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          onboardingComplete: true,
        },
      });
    } catch (profileError) {
      logger.warn('Failed to update user onboarding status', {
        error: String(profileError),
      });
    }

    // Emit webhook event for onboarding completion
    try {
      await webhookHandler.emit(
        'onboarding.completed' as any,
        {
          organization: {
            name: data.organizationName,
            industry: data.industry,
            teamSize: data.teamSize,
            website: data.website,
          },
          connectedPlatforms: data.connectedPlatforms,
          hasPersona: !data.skipPersona,
          persona: persona
            ? { name: persona.name, tone: persona.tone }
            : null,
          timestamp: new Date().toISOString(),
        },
        {
          userId: user.id,
          organizationId: organization.id,
        }
      );
    } catch (webhookError) {
      logger.warn('Failed to emit onboarding webhook', {
        error: String(webhookError),
      });
    }

    // Generate fresh JWT with onboardingComplete: true so middleware
    // stops redirecting to /onboarding on next request
    const newToken = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name ?? undefined,
      onboardingComplete: true,
      apiKeyConfigured: false, // Will be set later when user configures API key
    });

    const response = NextResponse.json({
      success: true,
      organization,
      persona,
    });

    // Set updated auth-token cookie
    response.cookies.set('auth-token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    logger.error('Onboarding error', { error: String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET — Get Onboarding Status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Verify authentication via JWT
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with onboarding status
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        onboardingComplete: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { users: { some: { id: userId } } },
    });

    // Get persona
    const persona = await prisma.persona.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Get connected platforms
    const connections = await prisma.platformConnection.findMany({
      where: { userId, isActive: true },
      select: { platform: true },
    });

    return NextResponse.json({
      completed: user.onboardingComplete,
      completedAt: user.onboardingComplete ? user.updatedAt?.toISOString() : null,
      organization: organization || null,
      persona: persona || null,
      connectedPlatforms: connections.map((c) => c.platform),
    });
  } catch (error) {
    logger.error('Get onboarding status error', { error: String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
