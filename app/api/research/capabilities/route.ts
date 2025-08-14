import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Return AI research capabilities
    const capabilities = {
      models: ['gpt-4', 'claude-3', 'gemini-pro'],
      features: [
        'competitor-analysis',
        'trend-detection',
        'market-research',
        'content-optimization'
      ],
      limits: {
        maxRequests: 100,
        maxTokens: 4000
      }
    };
    
    return NextResponse.json({ success: true, data: capabilities });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch capabilities' }, { status: 500 });
  }
}