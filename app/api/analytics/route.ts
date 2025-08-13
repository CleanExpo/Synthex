import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ data: { totals: { posts: 0, reach: 0 } } });
}

