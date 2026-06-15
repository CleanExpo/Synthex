# Scheduled-Report PDF/CSV Attachment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scheduled reports email a real **PDF** (and CSV) attachment instead of JSON-only, and the dead duplicate `ScheduledReportManager` is removed so there is a single source of truth.

**Architecture:** The working cron at `app/api/reports/scheduled/execute/route.ts` already gathers report data, persists a `Report`, sends via Resend/SendGrid, and records `ReportDelivery` — but its private `sendReportEmail` only attaches JSON (`generatePDF` is never called). We extract a small, pure, **exported** helper `buildReportAttachments()` into a new focused module `lib/reports/report-attachments.ts`, unit-test it (asserting the PDF bytes), then wire `sendReportEmail` (both Resend and SendGrid branches) to use it. Finally we delete the unused `ScheduledReportManager` class from `lib/analytics/report-builder.ts` (the dead path that caused the original misreport). No DB migration — the `ScheduledReport`/`Report`/`ReportDelivery` models already exist.

**Tech Stack:** Next.js 15 route handler, `jsPDF` via the existing `lib/reports/pdf-generator.ts` (`generatePDF`), Resend + SendGrid, Jest (`jest.worktree.cjs`, `@/` → repo root).

**Spec:** `/spec.md` backlog #1 (Reporting, §7 row 7). Acceptance: a `format:'pdf'` scheduled report emails a real `%PDF` attachment; dead manager removed; test asserts the attachment.

---

## File Structure

- **Create** `lib/reports/report-attachments.ts` — pure helper: build email attachments (PDF/CSV/JSON) from report data. One responsibility, no route/prisma coupling, trivially testable.
- **Create** `tests/unit/reports/report-attachments.test.ts` — unit tests for the helper.
- **Modify** `app/api/reports/scheduled/execute/route.ts` — `sendReportEmail` uses the helper; pass `reportType` through; attach on both Resend and SendGrid branches.
- **Modify** `lib/analytics/report-builder.ts` — delete the unused `ScheduledReportManager` class (keep `ReportBuilder`, `ReportExporter`, `ReportData` — those are used by `app/api/analytics/reports/route.ts`).

---

## Task 1: Pure attachment-builder helper (PDF branch)

**Files:**
- Create: `lib/reports/report-attachments.ts`
- Test: `tests/unit/reports/report-attachments.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/reports/report-attachments.test.ts
import { buildReportAttachments } from '@/lib/reports/report-attachments';

const SAMPLE = {
  summary: { impressions: 1200, engagements: 90 },
  byPlatform: { instagram: { impressions: 1200, engagements: 90 } },
  byDay: [{ date: '2026-06-01', metrics: { impressions: 1200, engagements: 90 } }],
  dateRange: { start: '2026-06-01', end: '2026-06-07' },
  generatedAt: '2026-06-07T00:00:00.000Z',
};

describe('buildReportAttachments', () => {
  it('produces a real PDF attachment for format "pdf"', async () => {
    const attachments = await buildReportAttachments(
      'Weekly Performance',
      'overview',
      SAMPLE,
      'pdf'
    );
    expect(attachments).toHaveLength(1);
    expect(attachments[0].filename).toBe('Weekly_Performance.pdf');
    expect(attachments[0].contentType).toBe('application/pdf');
    // base64 content must decode to bytes starting with the PDF magic header "%PDF"
    const decoded = Buffer.from(attachments[0].content, 'base64');
    expect(decoded.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/reports/report-attachments.test.ts`
Expected: FAIL — `Cannot find module '@/lib/reports/report-attachments'`.

- [ ] **Step 3: Write minimal implementation (PDF + JSON branches)**

```typescript
// lib/reports/report-attachments.ts
/**
 * Builds email attachments for scheduled reports.
 * Pure + provider-agnostic: returns base64 content so both Resend and SendGrid
 * can attach it. PDF uses the existing jsPDF generator (lib/reports/pdf-generator).
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

  // json (default / fallback)
  return [
    {
      filename: `${safeName}.json`,
      content: Buffer.from(JSON.stringify(reportData, null, 2)).toString('base64'),
      contentType: 'application/json',
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/reports/report-attachments.test.ts`
Expected: PASS (1 passing).

- [ ] **Step 5: Commit**

```bash
git add lib/reports/report-attachments.ts tests/unit/reports/report-attachments.test.ts
git commit -m "feat(reports): pure buildReportAttachments helper with real PDF attachment"
```

---

## Task 2: CSV branch

**Files:**
- Modify: `lib/reports/report-attachments.ts`
- Test: `tests/unit/reports/report-attachments.test.ts`

- [ ] **Step 1: Add the failing CSV test**

```typescript
// append inside describe('buildReportAttachments', ...)
it('produces a CSV attachment for format "csv"', async () => {
  const attachments = await buildReportAttachments(
    'Weekly Performance',
    'overview',
    SAMPLE,
    'csv'
  );
  expect(attachments[0].filename).toBe('Weekly_Performance.csv');
  expect(attachments[0].contentType).toBe('text/csv');
  const csv = Buffer.from(attachments[0].content, 'base64').toString('utf8');
  expect(csv).toContain('Metric,Value');
  expect(csv).toContain('impressions,1200');
  expect(csv).toContain('2026-06-01');
});

it('falls back to JSON for unknown formats', async () => {
  const attachments = await buildReportAttachments('R', 'overview', SAMPLE, 'json');
  expect(attachments[0].filename).toBe('R.json');
  expect(attachments[0].contentType).toBe('application/json');
});
```

- [ ] **Step 2: Run to verify the CSV test fails**

Run: `npm test -- tests/unit/reports/report-attachments.test.ts`
Expected: FAIL on the CSV case (filename/contentType are the JSON fallback).

- [ ] **Step 3: Add the CSV branch + helper**

In `lib/reports/report-attachments.ts`, add before the final `// json` return:

```typescript
  if (format === 'csv') {
    return [
      {
        filename: `${safeName}.csv`,
        content: Buffer.from(reportDataToCsv(reportData)).toString('base64'),
        contentType: 'text/csv',
      },
    ];
  }
```

And add this module-level helper at the bottom of the file:

```typescript
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
```

- [ ] **Step 4: Run to verify all pass**

Run: `npm test -- tests/unit/reports/report-attachments.test.ts`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git add lib/reports/report-attachments.ts tests/unit/reports/report-attachments.test.ts
git commit -m "feat(reports): CSV attachment branch for scheduled reports"
```

---

## Task 3: Wire the cron's sendReportEmail to use the helper

**Files:**
- Modify: `app/api/reports/scheduled/execute/route.ts` (import + `sendReportEmail` body at `:256-329` + call site at `:526-531`)

- [ ] **Step 1: Add the import**

At the top import block of `app/api/reports/scheduled/execute/route.ts` (after the existing imports, ~line 25):

```typescript
import { buildReportAttachments } from '@/lib/reports/report-attachments';
```

- [ ] **Step 2: Change the `sendReportEmail` signature to receive `reportType`**

Replace the signature (currently at `:256-261`):

```typescript
async function sendReportEmail(
  recipients: string[],
  reportName: string,
  reportData: ReportData,
  format: string
): Promise<number> {
```

with:

```typescript
async function sendReportEmail(
  recipients: string[],
  reportName: string,
  reportType: string,
  reportData: ReportData,
  format: string
): Promise<number> {
  const attachments = await buildReportAttachments(
    reportName,
    reportType,
    reportData,
    format
  );
```

- [ ] **Step 3: Use `attachments` in the Resend branch**

Replace the Resend `resend.emails.send({...})` attachment block (currently `:278-288`, the `format !== 'json' ? undefined : [...]`) with:

```typescript
            attachments: attachments.map((a) => ({
              filename: a.filename,
              content: a.content, // base64 string
            })),
```

- [ ] **Step 4: Add attachments to the SendGrid branch**

In the SendGrid `sgMail.default.send({...})` call (currently `:310-315`, which has no attachments), add the attachments field:

```typescript
          await sgMail.default.send({
            from: process.env.EMAIL_FROM || 'reports@synthex.social',
            to: recipient,
            subject: `${reportName} - ${new Date().toLocaleDateString()}`,
            html: generateEmailHtml(reportName, reportData),
            attachments: attachments.map((a) => ({
              content: a.content,
              filename: a.filename,
              type: a.contentType,
              disposition: 'attachment',
            })),
          });
```

- [ ] **Step 5: Update the call site to pass `reportType`**

At the call site (currently `:526-531`), change:

```typescript
          deliveryCount = await sendReportEmail(
            scheduled.recipients,
            scheduled.name,
            reportData,
            scheduled.format
          );
```

to:

```typescript
          deliveryCount = await sendReportEmail(
            scheduled.recipients,
            scheduled.name,
            scheduled.reportType,
            reportData,
            scheduled.format
          );
```

- [ ] **Step 6: Type-check (proves the wiring compiles end-to-end)**

Run: `npm run type-check`
Expected: PASS (zero errors). The cron's `ReportData` is structurally compatible with `ReportAttachmentData` (same `summary`/`byPlatform`/`byDay`/`dateRange`/`generatedAt` fields).

- [ ] **Step 7: Commit**

```bash
git add app/api/reports/scheduled/execute/route.ts
git commit -m "feat(reports): attach real PDF/CSV in scheduled-report cron emails (Resend + SendGrid)"
```

---

## Task 4: Delete the dead `ScheduledReportManager` + full gauntlet

**Files:**
- Modify: `lib/analytics/report-builder.ts` (remove `class ScheduledReportManager` at `:586`, and the `ScheduledReport`/`ReportSchedule` interfaces only if unused)

- [ ] **Step 1: Confirm there are no external importers**

Run: `rg -n "ScheduledReportManager" --glob '!spec.md' --glob '!docs/**'`
Expected: matches ONLY inside `lib/analytics/report-builder.ts`. (If anything else matches, stop and reassess — do not delete.)

- [ ] **Step 2: Delete the `ScheduledReportManager` class**

In `lib/analytics/report-builder.ts`, remove the entire `export class ScheduledReportManager { ... }` block (starts `:586`, includes `createScheduled`, `calculateNextRun`, `executeScheduledReport`, the placeholder `saveScheduledReport` at `:703`, and the no-op `sendReport` at `:711`). **Keep** `ReportBuilder`, `ReportExporter`, and the `ReportData` type (used by `app/api/analytics/reports/route.ts`).

- [ ] **Step 3: Remove now-orphaned interfaces if unused**

Run: `rg -n "ScheduledReport\b|ReportSchedule\b" lib/ app/ --glob '!app/api/reports/scheduled/execute/route.ts'`
- If `ScheduledReport` / `ReportSchedule` interfaces in `report-builder.ts` (`:120`) have no remaining users, delete those interface declarations too.
- If they are still referenced, leave them.

(The Prisma model `ScheduledReport` is unrelated — do not touch `prisma/schema.prisma`.)

- [ ] **Step 4: Run the targeted tests**

Run: `npm test -- tests/unit/reports/report-attachments.test.ts`
Expected: PASS (3 passing).

- [ ] **Step 5: Run the full pre-PR gauntlet**

Run: `npm run type-check && npm run lint && npm test -- tests/unit/reports`
Expected: type-check clean; lint `--max-warnings 0` clean; report tests green. Paste the actual `Tests: X passed` line.

- [ ] **Step 6: Production build check**

Run: `npm run build:vercel`
Expected: build completes (Prisma migrate + drift gate + next build). If it fails for reasons unrelated to this change, note and continue per build-engineer guidance.

- [ ] **Step 7: Commit**

```bash
git add lib/analytics/report-builder.ts
git commit -m "refactor(reports): remove dead ScheduledReportManager (single source of truth)"
```

---

## Verification (Gate, per spec §15 #1)

- **Unit proof:** `npm test -- tests/unit/reports/report-attachments.test.ts` → the PDF attachment's base64 content decodes to bytes starting with `%PDF` (asserted in Task 1).
- **Type/lint/build:** `npm run type-check && npm run lint` clean; `npm run build:vercel` succeeds.
- **Dead-code proof:** `rg -n "ScheduledReportManager"` returns only doc references (no code).
- **Live proof (post-deploy, optional manual):** create a `format:'pdf'` scheduled report via `app/api/reports/scheduled` with a real recipient, trigger `/api/reports/scheduled/execute` with the `CRON_SECRET`, and confirm the received email carries a `.pdf` attachment that opens.

---

## Self-Review

- **Spec coverage:** spec §8 #1 acceptance ("a `format:'pdf'` scheduled report emails a real `%PDF` attachment; dead manager removed; test asserts attachment") → Task 1 (PDF + test), Task 3 (wiring), Task 4 (delete). CSV is a bonus branch (Task 2) since `format` also allows `csv`. ✓
- **Placeholder scan:** every code step shows real code; commands have expected output. ✓
- **Type consistency:** helper exported as `buildReportAttachments(reportName, reportType, reportData, format)`; cron import + call site updated to the same 5-arg shape; `ReportAttachmentData` mirrors the cron `ReportData` fields used. ✓
- **No migration:** confirmed — `ScheduledReport`/`Report`/`ReportDelivery` models already exist (`schema.prisma:6478`/`:1100`/`:6541`). ✓
