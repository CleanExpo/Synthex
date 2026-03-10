import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import BrandPsychologyOrchestrator, { BrandGenerationInput } from '@/lib/ai/agents/strategic-marketing/brand-orchestrator';
import { getUserIdFromCookies, getUserIdFromRequest, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

const brandGenerateSchema = z.object({
  businessType: z.string().min(1),
  targetAudience: z.object({
    demographics: z.array(z.string()),
    psychographics: z.array(z.string()),
    painPoints: z.array(z.string()),
  }),
  brandGoals: z.array(z.string()).min(1),
  tonePreference: z.string().min(1),
  psychologyPreference: z.array(z.string()).optional(),
  competitorContext: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user ID from cookie or Authorization header
    const userId = await getUserIdFromCookies() || await getUserIdFromRequest(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    // Parse request body
    const body = await request.json();
    const validation = brandGenerateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const {
      businessType,
      targetAudience,
      brandGoals,
      tonePreference,
      psychologyPreference,
      competitorContext
    } = validation.data;

    // Initialize the orchestrator
    const orchestrator = new BrandPsychologyOrchestrator();

    // Generate brand with psychology
    const result = await orchestrator.generateBrand({
      businessType,
      targetAudience,
      brandGoals,
      tonePreference,
      psychologyPreference,
      competitorContext
    });

    // Save to database (JSON fields need double type assertion for Prisma InputJsonValue)
    const generation = await prisma.brandGeneration.create({
      data: {
        userId: userId,
        businessType: businessType,
        targetAudience: targetAudience,
        brandGoals: brandGoals,
        tonePreference: tonePreference,
        psychologyStrategy: result.psychologicalStrategy as unknown as Prisma.InputJsonValue,
        brandNames: result.brandNames as unknown as Prisma.InputJsonValue,
        taglines: result.taglines as unknown as Prisma.InputJsonValue,
        metadataPackages: result.metadataPackages as unknown as Prisma.InputJsonValue,
        implementationGuide: result.implementationGuide as unknown as Prisma.InputJsonValue,
        effectivenessScore: result.effectivenessScore,
        status: 'draft'
      }
    });

    // Update user preferences if psychology preferences provided
    if (psychologyPreference && psychologyPreference.length > 0) {
      await prisma.userPsychologyPreference.upsert({
        where: { userId: userId },
        update: {
          preferredPrinciples: psychologyPreference,
          industryFocus: businessType,
          targetDemographic: targetAudience,
          updatedAt: new Date()
        },
        create: {
          userId: userId,
          preferredPrinciples: psychologyPreference,
          industryFocus: businessType,
          targetDemographic: targetAudience
        }
      });
    }

    // Update principle usage counts
    if (result.psychologicalStrategy.primaryTriggers) {
      for (const trigger of result.psychologicalStrategy.primaryTriggers) {
        await prisma.psychologyPrinciple.update({
          where: { name: trigger.principle },
          data: {
            usageCount: { increment: 1 },
            updatedAt: new Date()
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      generationId: generation.id,
      result
    });

  } catch (error) {
    logger.error('Brand generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate brand' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user ID from cookie or Authorization header
    const userId = await getUserIdFromCookies() || await getUserIdFromRequest(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    // Get user's brand generations
    const generations = await prisma.brandGeneration.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return NextResponse.json({
      success: true,
      generations
    });

  } catch (error) {
    logger.error('Failed to fetch brand generations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brand generations' },
      { status: 500 }
    );
  }
}
// Node.js runtime required for Prisma
export const runtime = 'nodejs';
