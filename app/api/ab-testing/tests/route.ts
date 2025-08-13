import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ data: [] });
}

export async function POST() {
  return NextResponse.json({ id: 'test_1', status: 'created' });
}

