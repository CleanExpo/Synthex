import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
      data: [
        { id: '1', name: 'Sarah Johnson', email: 'sarah@example.com', role: 'admin', joinedAt: '2024-01-15', lastActive: new Date().toISOString(), stats: { campaigns: 45, content: 128, reach: 450000 } },
        { id: '2', name: 'Michael Chen', email: 'michael@example.com', role: 'editor', joinedAt: '2024-02-20', lastActive: new Date(Date.now()-2*3600000).toISOString(), stats: { campaigns: 23, content: 67, reach: 125000 } },
        { id: '3', name: 'Emily Davis', email: 'emily@example.com', role: 'editor', joinedAt: '2024-03-10', lastActive: new Date(Date.now()-24*3600000).toISOString(), stats: { campaigns: 18, content: 42, reach: 89000 } },
        { id: '4', name: 'James Wilson', email: 'james@example.com', role: 'viewer', joinedAt: '2024-04-05', lastActive: new Date(Date.now()-3*24*3600000).toISOString(), stats: { campaigns: 0, content: 0, reach: 0 } }
      ]
    });
}

