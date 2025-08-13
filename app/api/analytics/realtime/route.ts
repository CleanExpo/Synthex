import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ data: { online: 0 } });
}

