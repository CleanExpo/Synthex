import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const principles = [
      {
        id: 'social-proof',
        name: 'Social Proof',
        description: 'People follow the actions of others',
        applications: ['testimonials', 'reviews', 'user-counts']
      },
      {
        id: 'scarcity',
        name: 'Scarcity',
        description: 'Limited availability increases desire',
        applications: ['limited-time-offers', 'exclusive-access', 'countdown-timers']
      },
      {
        id: 'reciprocity',
        name: 'Reciprocity',
        description: 'People feel obligated to return favors',
        applications: ['free-trials', 'valuable-content', 'gifts']
      }
    ];
    
    return NextResponse.json({ success: true, principles });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch principles' }, { status: 500 });
  }
}