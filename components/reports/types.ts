/**
 * Reports Page Types
 */

import type { ComponentType, SVGProps } from 'react';

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export interface Report {
  id: string;
  name: string;
  type: 'campaign' | 'analytics' | 'ab-test' | 'psychology' | 'comprehensive';
  status: 'pending' | 'generating' | 'completed' | 'failed';
  format: 'pdf' | 'csv' | 'json';
  generatedAt: string | null;
  createdAt: string;
  downloadUrl: string | null;
}

export interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
}
