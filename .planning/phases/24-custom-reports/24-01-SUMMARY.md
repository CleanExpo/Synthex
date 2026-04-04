---
phase: 24-custom-reports
plan: 01
subsystem: reports
tags: [hooks, api-wiring, report-builder, templates, export]

requires:
  - phase: 23-02
    provides: predictive analytics complete

provides:
  - useReportTemplates hook (CRUD for report templates)
  - useReportExport hook (generate + poll + download)
  - ReportBuilder component wired to real APIs

affects: [reports, hooks]

tech-stack:
  added: []
  patterns: [fetch-with-polling, template-to-widget-mapping]

key-files:
  created: [hooks/use-report-templates.ts, hooks/use-report-export.ts, components/reports/report-builder.tsx]
  modified: [components/reports/index.ts]
  deleted: [components/CustomReportBuilder.tsx]

key-decisions:
  - "useReportExport polls every 2s with max 30 attempts (60s timeout)"
  - "Widget-to-visualization mapping: widget type maps to visualization type (chart->bar, table->table, metric->metric)"
  - "Data sources replaced with 5 real metric categories: Performance, Engagement, Growth, Content, Financial"
  - "Export format options simplified to PDF/CSV/JSON (matching API enum), removed Excel"

patterns-established:
  - "Template-to-widget conversion: API visualizations[] mapped to local ReportWidget[] for DnD"
  - "Widget-to-template conversion: local widgets serialized back to API visualizations[] and layout JSON on save"

issues-created: []

duration: ~12 min
completed: 2026-02-18
---

# Plan 24-01 Summary: Hook + API Wiring

## What Was Built

### Hooks

1. **useReportTemplates** (`hooks/use-report-templates.ts`) — Full CRUD hook for report templates. Fetches templates from `GET /api/reports/templates` with optional category filter. Provides `saveTemplate` (POST), `updateTemplate` (PATCH with id query param), `deleteTemplate` (DELETE with id query param), and `refetch`. Uses raw fetch + useState pattern with `credentials: 'include'`. All mutations automatically refetch the template list on success. Includes full TypeScript interfaces matching the API schema (ReportTemplate, TemplateVisualization, TemplateLayout, TemplateBranding, SaveTemplateParams).

2. **useReportExport** (`hooks/use-report-export.ts`) — Report generation hook with status polling. Calls `POST /api/reporting/generate` to start generation, then polls `GET /api/reporting/reports/[reportId]` every 2 seconds until status is `completed` or `failed` (max 30 attempts). Tracks `exportStatus` through `idle -> generating -> polling -> completed/failed` states. Returns download URL on completion. Includes `cancelGeneration` and `reset` utilities.

### Component Refactor

3. **ReportBuilder** (`components/reports/report-builder.tsx`) — Moved from `components/CustomReportBuilder.tsx` and refactored:
   - **Templates sidebar**: Replaced hardcoded 3-item mock array with `useReportTemplates()` hook. Shows loading spinner while fetching, empty state when no templates. Clicking a template converts its `visualizations[]` to local `ReportWidget[]` via `templateToWidgets()`.
   - **Data sources**: Replaced hardcoded `DataSource[]` with `METRIC_DATA_SOURCES` constant containing 5 real categories (Performance, Engagement, Growth, Content, Financial) with their actual metric IDs from the API.
   - **Save**: Replaced local-only `saveReport()` with `saveTemplate()` from the hook. Converts widgets to `visualizations[]` via `widgetsToVisualizations()` and builds a `layout` JSON. Shows loading spinner on the save button, toast on success/error.
   - **Export**: Replaced `setTimeout` simulation with `generateReport()` from `useReportExport`. Maps display format names to API format enum. Opens download URL in new tab on completion.
   - **DnD logic**: Completely unchanged. All @dnd-kit drag-drop, SortableWidget, widget add/edit/delete modal preserved.
   - **Styling**: All glassmorphic patterns preserved (Card variant="glass", bg-white/5, border-white/10).
   - **Type cleanup**: Replaced `any` assertions with proper type casts (`ReportWidget['type']`, `ReportWidget['size']`, `DragEndEvent`). Added `Record<string, unknown>` for widget config.

4. **Re-export**: Added `export { ReportBuilder } from './report-builder'` to `components/reports/index.ts`.
5. **Deletion**: Removed `components/CustomReportBuilder.tsx`.

## Verification

- `npm run type-check` passes with no new errors (pre-existing errors in lib/prisma.ts and lib/video/ are unrelated)
- No mock data remains in report-builder.tsx
- Both hooks handle loading/error states
- components/CustomReportBuilder.tsx deleted
- components/reports/index.ts exports ReportBuilder

## Commits

- `bed829c` -- `feat(24-01): create report builder hooks`
- `72dca1c` -- `feat(24-01): wire report builder to real APIs`
