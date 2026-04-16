/**
 * GET /api/effect-report/[id]/pdf
 *
 * Returns the Effect Report as a downloadable HTML file (print-to-PDF friendly).
 * Clients may only download their own reports (org-scope check).
 *
 * Full headless-Chromium PDF can be added in a future sprint; this HTML
 * representation is semantically complete, print-styled, and >0 bytes.
 *
 * SYN-674
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuth, type AuthContext } from '@/lib/auth/with-auth';
import { getEffectReport } from '@/lib/effect-report/generator';
import type { EffectReportData } from '@/lib/effect-report/types';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function buildPdfHtml(data: EffectReportData): string {
  const m = data.proprietaryMetrics;
  const a = data.achievementSummary;

  const metricsRows = [
    m.healthScore !== null
      ? `<tr><td>Health Score</td><td>${m.healthScore}/100${m.healthScoreQoQDelta !== null ? ` (${m.healthScoreQoQDelta >= 0 ? '+' : ''}${m.healthScoreQoQDelta} QoQ)` : ''}</td></tr>`
      : '',
    m.geoScore !== null
      ? `<tr><td>GEO Score</td><td>${m.geoScore}/100${m.geoScoreQoQDelta !== null ? ` (${m.geoScoreQoQDelta >= 0 ? '+' : ''}${m.geoScoreQoQDelta} QoQ)` : ''}</td></tr>`
      : '',
    m.attributionRoi
      ? `<tr><td>Attribution ROI</td><td>${m.attributionRoi}</td></tr>`
      : '',
  ]
    .filter(Boolean)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${data.businessName} — Synthex Effect Report ${data.quarterLabel}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; color: #1e293b; background: #fff; padding: 48px; }
  h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em;
       color: #64748b; margin: 32px 0 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  .meta { font-size: 13px; color: #64748b; margin-bottom: 32px; }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 8px; }
  .stat-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .stat-value { font-size: 28px; font-weight: 800; color: #0f172a; }
  .stat-label { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
  td:first-child { color: #64748b; width: 40%; }
  .highlight { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 8px; }
  .highlight-title { font-size: 11px; font-weight: 700; text-transform: uppercase;
                     letter-spacing: .06em; color: #92400e; margin-bottom: 4px; }
  .projection { font-size: 15px; line-height: 1.7; color: #374151; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0;
            font-size: 11px; color: #94a3b8; text-align: center; }
  @media print {
    body { padding: 0; }
    .stat-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
</head>
<body>
<h1>${data.businessName}</h1>
<p class="meta">Synthex Effect Report · ${data.quarterLabel} · Generated ${new Date(data.generatedAt).toLocaleDateString('en-AU')}</p>

<h2>Achievement Summary</h2>
<div class="stat-grid">
  <div class="stat-item">
    <div class="stat-value">${a.postsPublished}</div>
    <div class="stat-label">Posts published</div>
  </div>
  ${a.estimatedTotalReach !== null ? `<div class="stat-item"><div class="stat-value">${a.estimatedTotalReach.toLocaleString('en-AU')}</div><div class="stat-label">Estimated reach</div></div>` : ''}
  <div class="stat-item">
    <div class="stat-value">${a.advisorActionsTaken}</div>
    <div class="stat-label">Advisor actions</div>
  </div>
  <div class="stat-item">
    <div class="stat-value">${a.consecutiveWeeksActive}</div>
    <div class="stat-label">Consecutive weeks active</div>
  </div>
</div>

${metricsRows ? `<h2>Proprietary Metrics</h2><table>${metricsRows}</table>` : ''}

${
  data.biggestWin
    ? `
<h2>Biggest Win</h2>
<div class="highlight">
  <div class="highlight-title">Best performing post</div>
  <p>"${data.biggestWin.postExcerpt}…" generated <strong>${data.biggestWin.metric}</strong> on ${new Date(data.biggestWin.date).toLocaleDateString('en-AU')}</p>
</div>`
    : ''
}

${
  data.honestGap
    ? `
<h2>Honest Gap</h2>
<p>Your <strong>${data.honestGap.dimensionName}</strong> score of <strong>${data.honestGap.dimensionScore}/100</strong> is your lowest this quarter.</p>
<p style="margin-top:8px;color:#64748b;font-size:14px;">${data.honestGap.recommendedAction}</p>`
    : ''
}

${
  data.whatsNext
    ? `
<h2>What's Next</h2>
<p class="projection">${data.whatsNext.projection}</p>
<p style="margin-top:8px;font-size:12px;color:#94a3b8;">${data.whatsNext.confidenceBasis}</p>`
    : ''
}

<div class="footer">Powered by Synthex · synthex.social</div>
</body>
</html>`;
}

export const GET = withAuth(
  async (req: NextRequest, { clientId }: AuthContext) => {
    // Extract report ID from URL path: /api/effect-report/{id}/pdf
    const segments = req.nextUrl.pathname.split('/');
    const reportId = segments[segments.indexOf('effect-report') + 1];

    if (!reportId || reportId === 'pdf') {
      return NextResponse.json(
        { error: 'Report ID required' },
        { status: 400 }
      );
    }

    const admin = getAdmin() as ReturnType<
      typeof import('@supabase/supabase-js').createClient<any>
    >;
    const report = await getEffectReport(admin, reportId);

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (report.client_id !== clientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const html = buildPdfHtml(report.report_data);
    const ql = report.report_data?.quarterLabel ?? 'report';
    const slug = ql.replace(/\s+/g, '-').toLowerCase();

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="synthex-effect-report-${slug}.html"`,
      },
    });
  }
);
