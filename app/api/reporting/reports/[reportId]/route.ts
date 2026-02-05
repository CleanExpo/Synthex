/**
 * Report API - Single Report Operations
 *
 * Get, update, and delete individual reports
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { reportGenerator } from '@/lib/reports/report-generator';
import { getUserIdFromCookies } from '@/lib/auth/jwt-utils';

// Helper to get user ID from auth (uses centralized JWT verification)
async function getUserId(_request: NextRequest): Promise<string | null> {
  return getUserIdFromCookies();
}

/**
 * GET /api/reporting/reports/[reportId]
 * Get report details and status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { reportId } = await params;
    const report = await reportGenerator.getReport(reportId, userId);

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: report.id,
        name: report.name,
        type: report.type,
        status: report.status,
        format: report.format,
        data: report.status === 'completed' ? report.data : null,
        generatedAt: report.generatedAt?.toISOString() || null,
        createdAt: report.createdAt.toISOString(),
        downloadUrl: report.status === 'completed' ? `/api/reporting/reports/${report.id}/download` : null,
      },
    });
  } catch (error) {
    console.error('Report GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reporting/reports/[reportId]
 * Delete a report
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { reportId } = await params;
    const deleted = await reportGenerator.deleteReport(reportId, userId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error) {
    console.error('Report DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete report' },
      { status: 500 }
    );
  }
}
