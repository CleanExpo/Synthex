/**
 * Autopilot Page
 *
 * Server component wrapper — renders the client component.
 * ISR revalidation handled at the layout level; this page is user-scoped
 * so it intentionally stays dynamic.
 *
 * @task UNI-1652
 */

import { AutopilotPageClient } from './AutopilotPageClient';

export const metadata = {
  title: 'Autopilot — Synthex',
};

export default function AutopilotPage() {
  return <AutopilotPageClient />;
}
