// components/reports/report-builder.tsx — NOW A RE-EXPORT
// Original monolithic component (865 lines) has been decomposed into:
//   components/reports/builder/types.ts          — Types, interfaces, constants, helpers
//   components/reports/builder/SortableWidget.tsx — DnD sortable widget card
//   components/reports/builder/BuilderSidebar.tsx — Sidebar: details, templates, export
//   components/reports/builder/WidgetModal.tsx    — Add/edit widget modal
//   components/reports/builder/ScheduleModal.tsx  — Schedule report modal
//   components/reports/builder/index.tsx          — Main composition (state, DnD, layout)

export { ReportBuilder } from './builder';
