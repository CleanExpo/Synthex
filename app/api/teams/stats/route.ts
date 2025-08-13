import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ totalMembers: 4, activeCampaigns: 12, contentCreated: 248, totalReach: 125000 });
}

