import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import BrandPsychologyOrchestrator, { BrandGenerationInput } from '@/lib/ai/agents/strategic-marketing/brand-orchestrator';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
    const generation = await prisma.brand_generations.create({
      data: {
        user_id: session.user.id,
        business_type: businessType,
        target_audience: targetAudience,
        brand_goals: brandGoals,
        tone_preference: tonePreference,
        psychology_strategy: result.psychologicalStrategy,
        brand_names: result.brandNames,
        taglines: result.taglines,
        metadata_packages: result.metadataPackages,
        implementation_guide: result.implementationGuide,
        effectiveness_score: result.effectivenessScore,
        status: 'draft'
      }
    });

    // Update user preferences if psychology preferences provided
    if (psychologyPreference && psychologyPreference.length > 0) {
      await prisma.user_psychology_preferences.upsert({
        where: { user_id: session.user.id },
        update: {
          preferred_principles: psychologyPreference,
          industry_focus: businessType,
          target_demographic: targetAudience,
          updated_at: new Date()
        },
        create: {
          user_id: session.user.id,
          preferred_principles: psychologyPreference,
          industry_focus: businessType,
          target_demographic: targetAudience
        }
      });
    }

    // Update principle usage counts
    if (result.psychologicalStrategy.primaryTriggers) {
      for (const trigger of result.psychologicalStrategy.primaryTriggers) {
        await prisma.psychology_principles.update({
          where: { name: trigger.principle },
          data: {
            usage_count: { increment: 1 },
            updated_at: new Date()
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
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's brand generations
    const generations = await prisma.brand_generations.findMany({
      where: { user_id: session.user.id },
      orderBy: { created_at: 'desc' },
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