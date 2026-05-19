import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { generateMockCampaignPackage } from '@/lib/marketing-agency/orchestrator';

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const campaignPackage = generateMockCampaignPackage({ providerMode: 'mock' });

  return NextResponse.json({
    ok: true,
    campaignPackage,
  });
}
