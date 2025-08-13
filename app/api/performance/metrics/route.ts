import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ data: { ttfb: 0, fcp: 0 } });
}

