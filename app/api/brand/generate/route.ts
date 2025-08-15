import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import BrandPsychologyOrchestrator, { BrandGenerationInput } from '@/src/lib/ai/agents/strategic-marketing/brand-orchestrator';

export async function POST(request: NextRequest) {
  try {
    // Simple auth check - you can enhance this with your auth system
    const authHeader = request.headers.get('authorization');
    const userId = authHeader || 'demo-user'; // Use demo user for testing

    // Parse request body
    const body = await request.json();
    const {
      businessType,
      targetAudience,
      brandGoals,
      tonePreference,
      psychologyPreference,
      competitorContext
    } = body as BrandGenerationInput;

    // Validate required fields
    if (!businessType || !targetAudience || !brandGoals) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

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

    // Save to database
    const generation = await prisma.brandGeneration.create({
      data: {
        userId: userId,
        businessType: businessType,
        targetAudience: targetAudience,
        brandGoals: brandGoals,
        tonePreference: tonePreference,
        psychologyStrategy: result.psychologicalStrategy as any,
        brandNames: result.brandNames as any,
        taglines: result.taglines as any,
        metadataPackages: result.metadataPackages as any,
        implementationGuide: result.implementationGuide as any,
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
    console.error('Brand generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate brand' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Simple auth check
    const authHeader = request.headers.get('authorization');
    const userId = authHeader || 'demo-user';

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
    console.error('Failed to fetch brand generations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brand generations' },
      { status: 500 }
    );
  }
}
// Node.js runtime required for Prisma
export const runtime = 'nodejs';
