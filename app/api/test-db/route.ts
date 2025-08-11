import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Test database connection
    const userCount = await prisma.user.count();
    const campaignCount = await prisma.campaign.count();
    const postCount = await prisma.post.count();
    
    // Get recent audit logs
    const recentLogs = await prisma.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        action: true,
        resource: true,
        outcome: true,
        createdAt: true,
      }
    });

    return NextResponse.json({
      success: true,
      database: 'Connected',
      stats: {
        users: userCount,
        campaigns: campaignCount,
        posts: postCount,
      },
      recentActivity: recentLogs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Database test error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Database connection failed',
        details: error.message 
      },
      { status: 500 }
    );
  }
}