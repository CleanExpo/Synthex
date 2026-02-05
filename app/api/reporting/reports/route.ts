/**
 * Reports API - List Endpoint
 *
 * List and manage user's generated reports
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { reportGenerator } from '@/lib/reports/report-generator';

// Helper to get user ID from auth
async function getUserId(request: NextRequest): Promise<string | null> {
  const authToken = request.cookies.get('auth-token')?.value;
  if (!authToken) return null;
  return 'demo-user-001';
}

/**
 * GET /api/reporting/reports
 * List user's reports with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20', 10));
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const type = searchParams.get('type') || undefined;

    const { reports, total } = await reportGenerator.listReports(userId, {
      limit,
      offset,
      type,
    });

    return NextResponse.json({
      success: true,
      data: {
        reports: reports.map(r => ({
          id: r.id,
          name: r.name,
          type: r.type,
          status: r.status,
          format: r.format,
          generatedAt: r.generatedAt?.toISOString() || null,
          createdAt: r.createdAt.toISOString(),
          downloadUrl: r.status === 'completed' ? `/api/reporting/reports/${r.id}/download` : null,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    console.error('Reports list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
