'use client';

/**
 * Report Builder Page
 *
 * @description Drag-and-drop report builder for creating custom report templates.
 * Renders the ReportBuilder component which provides widget selection,
 * layout configuration, and template management.
 */

import { ReportBuilder } from '@/components/reports';

export default function ReportBuilderPage() {
  return (
    <div className="p-6">
      <ReportBuilder />
    </div>
  );
}
