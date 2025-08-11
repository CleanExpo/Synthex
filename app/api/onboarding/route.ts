import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const userData = await request.json();
    
    // Get the current user from auth token/session
    const authToken = request.headers.get('authorization');
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse user ID from token (you'll need to implement JWT verification)
    // For now, we'll store in user preferences
    
    // Update user profile with onboarding data
    const updatedUser = await prisma.user.update({
      where: { 
        id: userData.userId // This should come from the authenticated session
      },
      data: {
        name: userData.name || userData.companyName,
        preferences: {
          companyName: userData.companyName,
          industry: userData.industry,
          userType: userData.userType,
          teamSize: userData.teamSize,
          goals: userData.goals,
          platforms: userData.platforms,
          contentTypes: userData.contentTypes,
          onboardingComplete: true
        }
      }
    });
    
    return NextResponse.json({ 
      success: true,
      user: updatedUser
    });
    
  } catch (error: any) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save onboarding data' },
      { status: 500 }
    );
  }
}