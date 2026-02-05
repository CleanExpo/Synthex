/**
 * Report Download API
 *
 * Download generated reports in various formats
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
 * GET /api/reporting/reports/[reportId]/download
 * Download a generated report
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

    if (report.status !== 'completed') {
      return NextResponse.json(
        { error: 'Report is not ready for download', status: report.status },
        { status: 400 }
      );
    }

    if (!report.data) {
      return NextResponse.json(
        { error: 'Report data not available' },
        { status: 500 }
      );
    }

    // Generate file content based on format
    let content: string;
    let contentType: string;
    let filename: string;

    const safeName = report.name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const timestamp = new Date().toISOString().split('T')[0];

    switch (report.format) {
      case 'csv':
        content = generateCSV(report.data);
        contentType = 'text/csv';
        filename = `${safeName}_${timestamp}.csv`;
        break;
      case 'json':
        content = JSON.stringify(report.data, null, 2);
        contentType = 'application/json';
        filename = `${safeName}_${timestamp}.json`;
        break;
      case 'pdf':
      default:
        // Return PDF-ready data structure for client-side rendering
        content = JSON.stringify({
          type: 'pdf-data',
          version: '1.0',
          content: report.data,
          metadata: {
            title: report.name,
            generated: report.generatedAt?.toISOString(),
            type: report.type,
          },
        });
        contentType = 'application/json';
        filename = `${safeName}_${timestamp}.pdf.json`;
        break;
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Report download error:', error);
    return NextResponse.json(
      { error: 'Failed to download report' },
      { status: 500 }
    );
  }
}

/**
 * Generate CSV from report data
 */
function generateCSV(data: {
  summary: { title: string; dateRange: { start: string; end: string }; generatedAt: string };
  sections: Array<{ title: string; type: string; data: unknown }>;
}): string {
  const lines: string[] = [];

  // Header
  lines.push(`"${data.summary.title}"`);
  lines.push(`"Date Range","${data.summary.dateRange.start}","${data.summary.dateRange.end}"`);
  lines.push(`"Generated","${data.summary.generatedAt}"`);
  lines.push('');

  // Sections
  for (const section of data.sections) {
    lines.push(`"${section.title}"`);

    if (Array.isArray(section.data)) {
      if (section.data.length > 0) {
        const headers = Object.keys(section.data[0] as object);
        lines.push(headers.map(h => `"${h}"`).join(','));

        for (const row of section.data) {
          const values = headers.map(h => {
            const val = (row as Record<string, unknown>)[h];
            return `"${val !== undefined && val !== null ? String(val) : ''}"`;
          });
          lines.push(values.join(','));
        }
      }
    } else if (typeof section.data === 'object' && section.data !== null) {
      for (const [key, value] of Object.entries(section.data)) {
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        lines.push(`"${key}","${valueStr}"`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}
