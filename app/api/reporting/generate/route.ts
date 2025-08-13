import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ id: 'report_1', status: 'generated' });
}

