/**
 * Builds email attachments for scheduled reports.
 *
 * Pure + provider-agnostic: returns base64 content so both Resend and SendGrid
 * can attach it. PDF uses the existing jsPDF generator (lib/reports/pdf-generator).
 * Extracted so the cron's sendReportEmail attaches the real report file
 * (previously JSON-only) and so the logic is unit-testable in isolation.
 */
import { generatePDF } from '@/lib/reports/pdf-generator';

/** Minimal report shape needed to render an attachment (mirrors pdf-generator's ReportData). */
export interface ReportAttachmentData {
  summary: Record<string, number>;
  byPlatform?: Record<string, Record<string, number>>;
  byDay?: { date: string; metrics: Record<string, number> }[];
  dateRange: { start: string; end: string };
  generatedAt: string;
}

export interface ReportAttachment {
  filename: string;
  content: string; // base64
  contentType: string;
}

export async function buildReportAttachments(
  reportName: string,
  reportType: string,
  reportData: ReportAttachmentData,
  format: string
): Promise<ReportAttachment[]> {
  const safeName = reportName.replace(/\s+/g, '_');

  if (format === 'pdf') {
    const buffer = await generatePDF({
      name: reportName,
      type: reportType,
      dateRange: reportData.dateRange,
      summary: reportData.summary,
      byPlatform: reportData.byPlatform,
      byDay: reportData.byDay,
      generatedAt: reportData.generatedAt,
    });
    return [
      {
        filename: `${safeName}.pdf`,
        content: buffer.toString('base64'),
        contentType: 'application/pdf',
      },
    ];
  }

  if (format === 'csv') {
    return [
      {
        filename: `${safeName}.csv`,
        content: Buffer.from(reportDataToCsv(reportData)).toString('base64'),
        contentType: 'text/csv',
      },
    ];
  }

  // json (default / fallback)
  return [
    {
      filename: `${safeName}.json`,
      content: Buffer.from(JSON.stringify(reportData, null, 2)).toString('base64'),
      contentType: 'application/json',
    },
  ];
}

function reportDataToCsv(data: ReportAttachmentData): string {
  const lines: string[] = ['Metric,Value'];
  for (const [key, value] of Object.entries(data.summary || {})) {
    lines.push(`${key},${value}`);
  }
  if (data.byDay && data.byDay.length > 0) {
    const metricKeys = Object.keys(data.byDay[0].metrics || {});
    lines.push('');
    lines.push(['Date', ...metricKeys].join(','));
    for (const day of data.byDay) {
      lines.push([day.date, ...metricKeys.map((m) => day.metrics[m] ?? 0)].join(','));
    }
  }
  return lines.join('\n');
}
