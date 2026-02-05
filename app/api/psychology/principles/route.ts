/**
 * Psychology Principles API - Principles Endpoint
 *
 * Get and manage psychology principles for content optimization
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { psychologyAnalyzer } from '@/lib/ai/psychology-analyzer';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getUserIdFromCookies } from '@/lib/auth/jwt-utils';

const UpdatePreferencesSchema = z.object({
  preferredPrinciples: z.array(z.string()).optional(),
  avoidedPrinciples: z.array(z.string()).optional(),
  industryFocus: z.string().optional(),
  targetDemographic: z.object({
    ageRange: z.string().optional(),
    interests: z.array(z.string()).optional(),
    location: z.string().optional(),
  }).optional(),
});

// Helper to get user ID from auth (uses centralized JWT verification)
async function getUserId(_request: NextRequest): Promise<string | null> {
  return getUserIdFromCookies();
}

/**
 * GET /api/psychology/principles
 * Get all psychology principles with usage stats
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const sortBy = searchParams.get('sortBy') || 'effectiveness';

    // Get principles from analyzer (which checks DB first)
    const principles = await psychologyAnalyzer.getPrinciples();

    // Filter by category if specified
    let filtered = category
      ? principles.filter(p => p.category.toLowerCase() === category.toLowerCase())
      : principles;

    // Sort based on parameter
    if (sortBy === 'effectiveness') {
      filtered = filtered.sort((a, b) => b.effectivenessScore - a.effectivenessScore);
    } else if (sortBy === 'name') {
      filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Get user preferences if available
    let userPreferences = null;
    try {
      userPreferences = await prisma.userPsychologyPreference.findUnique({
        where: { userId },
      });
    } catch {
      // Preferences not available
    }

    // Get categories with counts
    const categories = [...new Set(principles.map(p => p.category))].map(cat => ({
      name: cat,
      count: principles.filter(p => p.category === cat).length,
    }));

    return NextResponse.json({
      success: true,
      data: {
        principles: filtered.map(p => ({
          ...p,
          isPreferred: userPreferences?.preferredPrinciples?.includes(p.id) || false,
          isAvoided: userPreferences?.avoidedPrinciples?.includes(p.id) || false,
        })),
        categories,
        userPreferences: userPreferences ? {
          preferredPrinciples: userPreferences.preferredPrinciples,
          avoidedPrinciples: userPreferences.avoidedPrinciples,
          industryFocus: userPreferences.industryFocus,
          targetDemographic: userPreferences.targetDemographic,
        } : null,
      },
    });
  } catch (error) {
    console.error('Psychology principles GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch principles' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/psychology/principles
 * Update user psychology preferences
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = UpdatePreferencesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { preferredPrinciples, avoidedPrinciples, industryFocus, targetDemographic } = validation.data;

    // Upsert user preferences
    const preferences = await prisma.userPsychologyPreference.upsert({
      where: { userId },
      update: {
        ...(preferredPrinciples && { preferredPrinciples }),
        ...(avoidedPrinciples && { avoidedPrinciples }),
        ...(industryFocus && { industryFocus }),
        ...(targetDemographic && { targetDemographic }),
      },
      create: {
        userId,
        preferredPrinciples: preferredPrinciples || [],
        avoidedPrinciples: avoidedPrinciples || [],
        industryFocus: industryFocus || null,
        targetDemographic: targetDemographic || {},
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        preferredPrinciples: preferences.preferredPrinciples,
        avoidedPrinciples: preferences.avoidedPrinciples,
        industryFocus: preferences.industryFocus,
        targetDemographic: preferences.targetDemographic,
      },
    });
  } catch (error) {
    console.error('Psychology preferences POST error:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/psychology/principles/[id]
 * Get detailed info for a specific principle
 */
export async function getPrincipleById(principleId: string) {
  const principles = await psychologyAnalyzer.getPrinciples();
  return principles.find(p => p.id === principleId) || null;
}
