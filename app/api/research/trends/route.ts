import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Mock trending topics - would connect to real trend API
    const trends = [
      { topic: 'AI Marketing', score: 95, growth: '+23%' },
      { topic: 'Sustainability', score: 87, growth: '+18%' },
      { topic: 'Remote Work', score: 82, growth: '+12%' },
      { topic: 'Web3', score: 76, growth: '+8%' }
    ];
    
    return NextResponse.json({ success: true, trends });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch trends' }, { status: 500 });
  }
}