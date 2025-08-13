import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ theme: {} });
}

export async function PUT() {
  return NextResponse.json({ success: true });
}

