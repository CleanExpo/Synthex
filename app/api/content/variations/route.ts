import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { content, platforms } = await request.json();
    
    // Generate content variations for different platforms
    const variations = platforms.map((platform: string) => ({
      platform,
      content: adaptContentForPlatform(content, platform),
      optimized: true,
      hashtags: generateHashtags(platform)
    }));
    
    return NextResponse.json({ success: true, variations });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate variations' }, { status: 500 });
  }
}

function adaptContentForPlatform(content: string, platform: string): string {
  // Platform-specific content adaptation
  const limits: Record<string, number> = {
    twitter: 280,
    instagram: 2200,
    linkedin: 3000,
    facebook: 63206
  };
  
  const limit = limits[platform.toLowerCase()] || 500;
  return content.substring(0, limit);
}

function generateHashtags(platform: string): string[] {
  const hashtags: Record<string, string[]> = {
    twitter: ['#Marketing', '#AI', '#Growth'],
    instagram: ['#MarketingTips', '#AIMarketing', '#ContentStrategy', '#DigitalMarketing'],
    linkedin: ['#B2BMarketing', '#ThoughtLeadership', '#Innovation'],
    facebook: ['#Business', '#Marketing', '#Success']
  };
  
  return hashtags[platform.toLowerCase()] || [];
}