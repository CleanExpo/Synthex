import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
      data: [
        { id: '1', memberId: '1', memberName: 'Sarah Johnson', action: 'created a new campaign', target: 'Summer Sale 2024', timestamp: new Date(Date.now()-30*60000).toISOString() },
        { id: '2', memberId: '2', memberName: 'Michael Chen', action: 'published content to', target: 'Instagram', timestamp: new Date(Date.now()-2*3600000).toISOString() },
        { id: '3', memberId: '3', memberName: 'Emily Davis', action: 'generated AI content for', target: 'Product Launch', timestamp: new Date(Date.now()-5*3600000).toISOString() }
      ]
    });
}

