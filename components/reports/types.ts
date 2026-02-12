/**
 * Reports Page Types
 */

import type { LucideIcon } from 'lucide-react';

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
