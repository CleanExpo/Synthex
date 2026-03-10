import { Metadata } from 'next';
import { WorkflowsPageClient } from '@/components/workflows/WorkflowsPageClient';

export const metadata: Metadata = {
  title: 'Workflows | Synthex',
  description: 'Monitor and manage AI workflow executions, approve steps, and start new automations.',
};

/**
 * Workflows page — Server Component wrapper.
 * Client component handles all data fetching via SWR.
 */
export default function WorkflowsPage() {
  return <WorkflowsPageClient />;
}
