import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const maxDuration = 300;

// DESCHEDULED (SYN-1101, 2026-07-16): removed from vercel.json crons because
// patternScraper.scrapePlatform() is a stub (returns []), so the scheduled run
// did nothing but report success daily. Keep both triggers fail-closed until
// real per-platform scraping is built; re-add the schedule only then.
//
function unavailableResponse() {
  return NextResponse.json(
    {
      error:
        'Pattern analysis is unavailable until platform integrations are configured.',
    },
    { status: 503 }
  );
}

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'ANALYZE_PATTERNS');
  if (!auth.ok) return auth.response;

  return unavailableResponse();
}

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'ANALYZE_PATTERNS');
  if (!auth.ok) return auth.response;

  return unavailableResponse();
}
